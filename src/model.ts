// Модель данных «Квитов». Всё состояние — набор сущностей с отметкой
// времени (at) и автором изменения (by = id устройства). При слиянии
// побеждает более поздняя версия (last-writer-wins).

export type Member = { id: string; name: string };

type Base = { id: string; at: number; by: string; deleted?: boolean };

export type Home = Base & { kind: 'home'; homeId: string; members: Member[] };
export type Chore = Base & { kind: 'chore'; name: string; price: number; createdAt: number };
export type DealItem = { c: string; name: string; price: number; n: number };
export type DealStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'countered';
export type Deal = Base & {
  kind: 'deal';
  from: string;
  to: string;
  give: DealItem[]; // что делает автор предложения
  take: DealItem[]; // что делает адресат
  note: string;
  status: DealStatus;
  createdAt: number;
  replyTo: string | null;
};
export type Task = Base & {
  kind: 'task';
  chore: string;
  name: string;
  price: number;
  who: string;
  deal: string | null;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
};
export type Entity = Home | Chore | Deal | Task;

export type Vector = Record<string, number>;

export type DB = {
  homeId: string | null;
  entities: Record<string, Entity>;
  /** Для каждого устройства-автора: до какого момента у нас есть все его изменения. */
  know: Vector;
};

export type Peer = { know: Vector; member: string | null; seenAt: number };

export type Device = {
  deviceId: string;
  me: string | null;
  clock: number;
  peers: Record<string, Peer>;
};

export const emptyDB = (): DB => ({ homeId: null, entities: {}, know: {} });

export const STATUS_LABEL: Record<DealStatus, string> = {
  pending: 'ждёт ответа',
  accepted: 'принята',
  declined: 'отклонена',
  withdrawn: 'отозвана',
  countered: 'встречное',
};

export const STARTER_CHORES: [string, number][] = [
  ['Помыть посуду', 3],
  ['Вынести мусор', 2],
  ['Пропылесосить квартиру', 6],
  ['Помыть полы', 8],
  ['Почистить ванную и туалет', 10],
  ['Постирать и развесить бельё', 4],
  ['Сходить за продуктами', 5],
  ['Приготовить ужин', 5],
  ['Помыть холодильник', 12],
  ['Помыть окна', 15],
  ['Разобрать балкон', 20],
];

/* ---------- выборки ---------- */

export function getHome(db: DB): Home | null {
  const h = db.entities['home'];
  return h && h.kind === 'home' && !h.deleted ? h : null;
}
export const members = (db: DB): Member[] => getHome(db)?.members ?? [];

export function chores(db: DB): Chore[] {
  return Object.values(db.entities)
    .filter((e): e is Chore => e.kind === 'chore' && !e.deleted)
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name, 'ru'));
}
export function deals(db: DB): Deal[] {
  return Object.values(db.entities)
    .filter((e): e is Deal => e.kind === 'deal' && !e.deleted)
    .sort((a, b) => b.createdAt - a.createdAt);
}
/** Задачи, которые считаются: без сделки или по принятой сделке. */
export function tasks(db: DB): Task[] {
  return Object.values(db.entities).filter((e): e is Task => {
    if (e.kind !== 'task' || e.deleted) return false;
    if (!e.deal) return true;
    const d = db.entities[e.deal];
    return !!d && d.kind === 'deal' && d.status === 'accepted';
  });
}

export function lotNumbers(db: DB): Record<string, number> {
  const map: Record<string, number> = {};
  Object.values(db.entities)
    .filter((e): e is Deal => e.kind === 'deal')
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .forEach((d, i) => (map[d.id] = i + 1));
  return map;
}

export function stats(db: DB): Record<string, { done: number; open: number }> {
  const m: Record<string, { done: number; open: number }> = {};
  members(db).forEach((x) => (m[x.id] = { done: 0, open: 0 }));
  tasks(db).forEach((t) => {
    if (!m[t.who]) return;
    if (t.done) m[t.who].done += t.price;
    else m[t.who].open += t.price;
  });
  return m;
}

export const sumItems = (items: DealItem[]) => items.reduce((s, x) => s + x.price * x.n, 0);

/* ---------- текст ---------- */

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const pts = (n: number) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`;

export function ago(t: number | null | undefined, now = Date.now()) {
  if (!t) return '';
  const s = (now - t) / 1000;
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  if (s < 172800) return 'вчера';
  const d = new Date(t);
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export type FairKind = 'ok' | 'warn' | 'bad' | 'muted';
/** a — сколько делает сторона A, b — сторона B. */
export function fairness(a: number, b: number, nameA: string, nameB: string, aIsYou = false): { k: FairKind; t: string } {
  if (a === 0 && b === 0) return { k: 'muted', t: 'Добавьте дела хотя бы с одной стороны' };
  const d = Math.abs(a - b);
  if (d === 0) return { k: 'ok', t: 'Ровно. Квиты' };
  const heavy = a > b ? (aIsYou ? 'Вы делаете' : `${nameA} делает`) : `${nameB} делает`;
  const p = d / Math.max(a, b);
  const tail = `на ${pts(d)} больше`;
  if (p <= 0.1) return { k: 'ok', t: `Почти поровну: ${lowerFirst(heavy, aIsYou && a > b)} ${tail}` };
  if (p <= 0.3) return { k: 'warn', t: `${heavy} ${tail}` };
  return { k: 'bad', t: `Перекос: ${lowerFirst(heavy, aIsYou && a > b)} ${tail}` };
}
const lowerFirst = (s: string, isYou: boolean) => (isYou ? s.charAt(0).toLowerCase() + s.slice(1) : s);
