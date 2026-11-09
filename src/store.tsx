import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  Chore, DB, Deal, DealItem, DealStatus, Device, Entity, Home, STARTER_CHORES, Task, emptyDB,
} from './model';
import {
  ImportResult, Payload, adoptPayload, decodeCode, importPayload, putLocal, randomId,
} from './sync';

const KEY_DB = 'kvity.db.v1';
const KEY_DEVICE = 'kvity.device.v1';

type State = { db: DB; device: Device };

type Actions = {
  createHome(names: string[], meIndex: number, starter: boolean): void;
  setMe(id: string): void;
  addChore(name: string, price: number): void;
  setChorePrice(id: string, price: number): void;
  deleteChore(id: string): void;
  renameMember(id: string, name: string): void;
  proposeDeal(d: { to: string; give: DealItem[]; take: DealItem[]; note: string; replyTo: string | null }): void;
  setDealStatus(id: string, status: DealStatus): void;
  acceptDeal(id: string): void;
  markDone(taskId: string): void;
  quickDone(choreId: string): void;
  undoTask(taskId: string): void;
  importCode(raw: string): ImportResult & { payload: Payload };
  adopt(payload: Payload): void;
  resetAll(): void;
};

type Ctx = State & { ready: boolean; actions: Actions };

const StoreCtx = createContext<Ctx | null>(null);

const newDevice = (): Device => ({ deviceId: 'd' + randomId(12), me: null, clock: 0, peers: {} });

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ db: emptyDB(), device: newDevice() });
  const [ready, setReady] = useState(false);
  const ref = useRef(state);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // загрузка
  useEffect(() => {
    (async () => {
      try {
        const [rawDb, rawDev] = await Promise.all([AsyncStorage.getItem(KEY_DB), AsyncStorage.getItem(KEY_DEVICE)]);
        const db: DB = rawDb ? JSON.parse(rawDb) : emptyDB();
        const device: Device = rawDev ? JSON.parse(rawDev) : newDevice();
        ref.current = { db, device };
        setState(ref.current);
        if (!rawDev) await AsyncStorage.setItem(KEY_DEVICE, JSON.stringify(device));
      } catch {
        // повреждённые данные — начинаем с чистого листа, старое не трогаем
      }
      setReady(true);
    })();
  }, []);

  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const { db, device } = ref.current;
    try {
      await AsyncStorage.multiSet([[KEY_DB, JSON.stringify(db)], [KEY_DEVICE, JSON.stringify(device)]]);
    } catch {}
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  /** Копия верхнего уровня; сущности не мутируются, а заменяются. */
  const update = useCallback(<T,>(fn: (db: DB, device: Device) => T): T => {
    const cur = ref.current;
    const db: DB = { ...cur.db, entities: { ...cur.db.entities }, know: { ...cur.db.know } };
    const device: Device = { ...cur.device, peers: { ...cur.device.peers } };
    const out = fn(db, device);
    ref.current = { db, device };
    setState(ref.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 250);
    return out;
  }, [flush]);

  const actions = useMemo<Actions>(() => {
    const get = <K extends Entity['kind']>(db: DB, id: string, kind: K) => {
      const e = db.entities[id];
      return e && e.kind === kind && !e.deleted ? (e as Extract<Entity, { kind: K }>) : null;
    };
    const blank = { at: 0, by: '' };
    return {
      createHome(names, meIndex, starter) {
        update((db, dev) => {
          db.homeId = 'h' + randomId(12);
          const members = names.map((name, i) => ({ id: 'm' + randomId(6) + i, name }));
          putLocal(db, dev, { ...blank, id: 'home', kind: 'home', homeId: db.homeId, members } as Home);
          if (starter) {
            const now = Date.now();
            STARTER_CHORES.forEach(([name, price], i) =>
              putLocal(db, dev, { ...blank, id: 'c' + randomId(10), kind: 'chore', name, price, createdAt: now + i } as Chore));
          }
          dev.me = members[meIndex]?.id ?? members[0].id;
        });
      },
      setMe(id) {
        update((_, dev) => { dev.me = id; });
      },
      addChore(name, price) {
        update((db, dev) => putLocal(db, dev, { ...blank, id: 'c' + randomId(10), kind: 'chore', name, price, createdAt: Date.now() } as Chore));
      },
      setChorePrice(id, price) {
        update((db, dev) => { const c = get(db, id, 'chore'); if (c) putLocal(db, dev, { ...c, price }); });
      },
      deleteChore(id) {
        update((db, dev) => { const c = get(db, id, 'chore'); if (c) putLocal(db, dev, { ...c, deleted: true }); });
      },
      renameMember(id, name) {
        update((db, dev) => {
          const h = get(db, 'home', 'home');
          if (h) putLocal(db, dev, { ...h, members: h.members.map((m) => (m.id === id ? { ...m, name } : m)) });
        });
      },
      proposeDeal({ to, give, take, note, replyTo }) {
        update((db, dev) => {
          if (!dev.me) return;
          putLocal(db, dev, { ...blank, id: 'l' + randomId(10), kind: 'deal', from: dev.me, to, give, take, note, status: 'pending', createdAt: Date.now(), replyTo } as Deal);
          if (replyTo) {
            const old = get(db, replyTo, 'deal');
            if (old && old.status === 'pending') putLocal(db, dev, { ...old, status: 'countered' });
          }
        });
      },
      setDealStatus(id, status) {
        update((db, dev) => { const d = get(db, id, 'deal'); if (d && d.status === 'pending') putLocal(db, dev, { ...d, status }); });
      },
      acceptDeal(id) {
        update((db, dev) => {
          const d = get(db, id, 'deal');
          if (!d || d.status !== 'pending') return;
          putLocal(db, dev, { ...d, status: 'accepted' });
          const now = Date.now();
          let k = 0;
          const mk = (items: DealItem[], who: string) =>
            items.forEach((x) => {
              for (let i = 0; i < x.n; i++) {
                putLocal(db, dev, {
                  ...blank, id: 't' + randomId(10), kind: 'task', chore: x.c, name: x.name, price: x.price,
                  who, deal: d.id, done: false, doneAt: null, createdAt: now + k++,
                } as Task);
              }
            });
          mk(d.give, d.from);
          mk(d.take, d.to);
        });
      },
      markDone(taskId) {
        update((db, dev) => { const t = get(db, taskId, 'task'); if (t && !t.done) putLocal(db, dev, { ...t, done: true, doneAt: Date.now() }); });
      },
      quickDone(choreId) {
        update((db, dev) => {
          const c = get(db, choreId, 'chore');
          if (!c || !dev.me) return;
          const now = Date.now();
          putLocal(db, dev, { ...blank, id: 't' + randomId(10), kind: 'task', chore: c.id, name: c.name, price: c.price, who: dev.me, deal: null, done: true, doneAt: now, createdAt: now } as Task);
        });
      },
      undoTask(taskId) {
        update((db, dev) => {
          const t = get(db, taskId, 'task');
          if (!t) return;
          putLocal(db, dev, t.deal ? { ...t, done: false, doneAt: null } : { ...t, deleted: true });
        });
      },
      importCode(raw) {
        const payload = decodeCode(raw); // бросает CodeError
        const cur = ref.current;
        // проверяем на копии, применяем только при успехе
        const db: DB = { ...cur.db, entities: { ...cur.db.entities }, know: { ...cur.db.know } };
        const device: Device = { ...cur.device, peers: { ...cur.device.peers } };
        const res = importPayload(db, device, payload);
        if (res.type === 'ok') update((d, v) => { Object.assign(d, db); Object.assign(v, device); });
        return { ...res, payload };
      },
      adopt(payload) {
        update((db, dev) => { Object.assign(db, adoptPayload(dev, payload)); });
      },
      resetAll() {
        update((db, dev) => {
          Object.assign(db, emptyDB());
          Object.assign(dev, newDevice());
        });
      },
    };
  }, [update]);

  const value = useMemo<Ctx>(() => ({ ...state, ready, actions }), [state, ready, actions]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}
