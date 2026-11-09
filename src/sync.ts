// Синхронизация без сервера: телефоны обмениваются кодами (QR или текст).
// Каждое устройство помнит вектор знаний: для каждого автора — момент,
// до которого у него есть все изменения этого автора. Код содержит только
// изменения новее «базы» — того, что, по нашим данным, уже есть у соседей.
// Получатель проверяет, что у него есть всё до базы; если нет — просит полный код.
import { deflate, inflate } from 'pako';
import type { DB, Device, Entity, Vector } from './model';

export const CODE_PREFIX = 'KVITY1.';
const FRAME_PREFIX = 'KV1|';
export const FRAME_CHARS = 600;

export type Payload = {
  v: 1;
  home: string;
  from: string; // id устройства
  member: string | null; // кем представился отправитель
  know: Vector;
  base: Vector;
  items: Entity[];
};

/* ---------- часы и локальные изменения ---------- */

export function tick(device: Device): number {
  device.clock = Math.max(Date.now(), device.clock + 1);
  return device.clock;
}

/** Записать локальное изменение (мутирует db и device). */
export function putLocal(db: DB, device: Device, e: Entity) {
  const at = tick(device);
  db.entities[e.id] = { ...e, at, by: device.deviceId } as Entity;
  db.know[device.deviceId] = Math.max(db.know[device.deviceId] ?? 0, at);
}

const newer = (a: Entity, b: Entity | undefined) => !b || a.at > b.at || (a.at === b.at && a.by > b.by);

export function mergeItems(db: DB, items: Entity[]): number {
  let changed = 0;
  for (const e of items) {
    if (newer(e, db.entities[e.id])) {
      db.entities[e.id] = e;
      changed++;
    }
  }
  return changed;
}

/* ---------- экспорт ---------- */

/** База = минимум знаний всех известных соседей (то, что точно есть у каждого). */
export function exportBase(db: DB, device: Device, full: boolean): Vector {
  const peers = Object.values(device.peers);
  if (full || peers.length === 0) return {};
  const base: Vector = {};
  for (const author of Object.keys(db.know)) {
    const v = Math.min(...peers.map((p) => p.know[author] ?? 0));
    if (v > 0) base[author] = v;
  }
  return base;
}

export function buildPayload(db: DB, device: Device, full: boolean): Payload {
  const base = exportBase(db, device, full);
  const items = Object.values(db.entities).filter((e) => e.at > (base[e.by] ?? 0));
  return { v: 1, home: db.homeId ?? '', from: device.deviceId, member: device.me, know: { ...db.know }, base, items };
}

/* ---------- импорт ---------- */

export type ImportResult =
  | { type: 'ok'; changed: number; member: string | null }
  | { type: 'self' }
  | { type: 'gap' } // не хватает старых данных — нужен полный код
  | { type: 'other-home'; full: boolean }; // код от другого «дома»

export function hasGap(db: DB, base: Vector) {
  return Object.entries(base).some(([a, t]) => (db.know[a] ?? 0) < t);
}

/** Проверить и применить код (мутирует db и device при успехе). */
export function importPayload(db: DB, device: Device, p: Payload): ImportResult {
  if (p.from === device.deviceId) return { type: 'self' };
  if (db.homeId && p.home !== db.homeId) return { type: 'other-home', full: Object.keys(p.base).length === 0 };
  if (hasGap(db, p.base)) return { type: 'gap' };
  if (!db.homeId) db.homeId = p.home;
  const changed = mergeItems(db, p.items);
  for (const [a, t] of Object.entries(p.know)) db.know[a] = Math.max(db.know[a] ?? 0, t);
  const maxSeen = Math.max(0, ...Object.values(p.know));
  device.clock = Math.max(device.clock, maxSeen);
  const prev = device.peers[p.from];
  const know: Vector = { ...(prev?.know ?? {}) };
  for (const [a, t] of Object.entries(p.know)) know[a] = Math.max(know[a] ?? 0, t);
  device.peers[p.from] = { know, member: p.member, seenAt: Date.now() };
  return { type: 'ok', changed, member: p.member };
}

/** Заменить все данные на данные из полного кода другого дома. */
export function adoptPayload(device: Device, p: Payload): DB {
  const db: DB = { homeId: p.home, entities: {}, know: {} };
  mergeItems(db, p.items);
  db.know = { ...p.know };
  device.clock = Math.max(device.clock, ...Object.values(p.know), 0);
  device.peers = { [p.from]: { know: { ...p.know }, member: p.member, seenAt: Date.now() } };
  device.me = null;
  return db;
}

/* ---------- кодирование ---------- */

function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

function utf8Decode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const REV: Record<string, number> = {};
for (let i = 0; i < ABC.length; i++) REV[ABC[i]] = i;

function b64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 3) {
    const n = (u[i] << 16) | ((u[i + 1] ?? 0) << 8) | (u[i + 2] ?? 0);
    s += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63];
    if (i + 1 < u.length) s += ABC[(n >> 6) & 63];
    if (i + 2 < u.length) s += ABC[n & 63];
  }
  return s;
}

function unb64(s: string): Uint8Array {
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const g = (k: number) => {
      if (i + k >= s.length) return 0;
      const v = REV[s[i + k]];
      if (v === undefined) throw new Error('bad char');
      return v;
    };
    const n = (g(0) << 18) | (g(1) << 12) | (g(2) << 6) | g(3);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < s.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < s.length) out[o++] = n & 255;
  }
  return out.slice(0, o);
}

export function encodeCode(p: Payload): string {
  return CODE_PREFIX + b64(deflate(utf8Encode(JSON.stringify(p)), { level: 9 }));
}

export class CodeError extends Error {}

export function decodeCode(raw: string): Payload {
  const s = raw.trim().replace(/\s+/g, '');
  const i = s.indexOf(CODE_PREFIX);
  if (i < 0) throw new CodeError('Это не код «Квитов».');
  let p: Payload;
  try {
    p = JSON.parse(utf8Decode(inflate(unb64(s.slice(i + CODE_PREFIX.length)))));
  } catch {
    throw new CodeError('Код повреждён или скопирован не полностью.');
  }
  if (!p || p.v !== 1 || !Array.isArray(p.items) || typeof p.from !== 'string') throw new CodeError('Код от несовместимой версии приложения.');
  return p;
}

/* ---------- QR-кадры ---------- */

/** Длинный код режется на кадры, которые QR показывает по очереди. */
export function framesFor(code: string, sid: string): string[] {
  const body = code.slice(CODE_PREFIX.length);
  const n = Math.max(1, Math.ceil(body.length / FRAME_CHARS));
  return Array.from({ length: n }, (_, i) => `${FRAME_PREFIX}${sid}|${i + 1}|${n}|${body.slice(i * FRAME_CHARS, (i + 1) * FRAME_CHARS)}`);
}

export class FrameCollector {
  sid: string | null = null;
  total = 0;
  parts = new Map<number, string>();

  /** Возвращает собранный код, когда пришли все кадры. */
  add(text: string): string | null {
    if (text.startsWith(CODE_PREFIX)) return text;
    if (!text.startsWith(FRAME_PREFIX)) return null;
    const [, sid, iStr, nStr, ...rest] = text.split('|');
    const i = Number(iStr);
    const n = Number(nStr);
    if (!sid || !i || !n) return null;
    if (sid !== this.sid) {
      this.sid = sid;
      this.total = n;
      this.parts.clear();
    }
    this.parts.set(i, rest.join('|'));
    if (this.parts.size === this.total) {
      let body = '';
      for (let k = 1; k <= this.total; k++) body += this.parts.get(k) ?? '';
      return CODE_PREFIX + body;
    }
    return null;
  }

  get progress() {
    return { got: this.parts.size, total: this.total };
  }

  reset() {
    this.sid = null;
    this.total = 0;
    this.parts.clear();
  }
}

export function randomId(len = 10): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ABC[Math.floor(Math.random() * 62)];
  return s;
}
