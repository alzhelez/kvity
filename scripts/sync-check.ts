// Прогон синхронизации трёх телефонов: npx tsx scripts/sync-check.ts
import { Chore, DB, Device, Home, emptyDB, stats, tasks } from '../src/model';
import { FrameCollector, buildPayload, decodeCode, encodeCode, framesFor, importPayload, putLocal } from '../src/sync';

const dev = (id: string): Device => ({ deviceId: id, me: null, clock: 0, peers: {} });
const A = { db: emptyDB(), dev: dev('dA') };
const B = { db: emptyDB(), dev: dev('dB') };
const C = { db: emptyDB(), dev: dev('dC') };
const blank = { at: 0, by: '' };
let ok = true;
const check = (cond: boolean, msg: string) => { console.log((cond ? 'OK   ' : 'FAIL ') + msg); if (!cond) ok = false; };

function send(from: { db: DB; dev: Device }, to: { db: DB; dev: Device }, full = false) {
  const code = encodeCode(buildPayload(from.db, from.dev, full));
  // через QR-кадры
  const fc = new FrameCollector();
  let got: string | null = null;
  for (const f of framesFor(code, 'abcd').reverse()) got = fc.add(f) ?? got;
  check(got === code, `кадры собираются обратно (${framesFor(code, 'x').length} кадр.)`);
  return importPayload(to.db, to.dev, decodeCode(got!));
}

// A создаёт дом
A.db.homeId = 'h1';
putLocal(A.db, A.dev, { ...blank, id: 'home', kind: 'home', homeId: 'h1', members: [{ id: 'm1', name: 'Саша' }, { id: 'm2', name: 'Маша' }] } as Home);
for (let i = 0; i < 11; i++) putLocal(A.db, A.dev, { ...blank, id: 'c' + i, kind: 'chore', name: 'Дело ' + i, price: i + 1, createdAt: i } as Chore);
A.dev.me = 'm1';

let r = send(A, B);
check(r.type === 'ok' && B.db.homeId === 'h1' && Object.keys(B.db.entities).length === 12, 'B получил весь дом');

// B предлагает сделку, A ещё не знает
putLocal(B.db, B.dev, { ...blank, id: 'l1', kind: 'deal', from: 'm2', to: 'm1', give: [{ c: 'c2', name: 'Дело 2', price: 3, n: 7 }], take: [{ c: 'c9', name: 'Дело 9', price: 20, n: 1 }], note: '', status: 'pending', createdAt: 1, replyTo: null } as any);
const deltaB = buildPayload(B.db, B.dev, false);
check(deltaB.items.length === 1, `B отправляет только новую сделку: знает, что у A уже есть (${deltaB.items.length})`);
r = send(B, A);
check(r.type === 'ok' && !!A.db.entities['l1'], 'A получил сделку');
const deltaA = buildPayload(A.db, A.dev, false);
check(deltaA.items.length === 0, `A ничего не отправляет повторно (${deltaA.items.length})`);

// одновременные правки цены: позже — побеждает
putLocal(A.db, A.dev, { ...(A.db.entities['c3'] as Chore), price: 50 });
putLocal(B.db, B.dev, { ...(B.db.entities['c3'] as Chore), price: 70 });
send(A, B); send(B, A);
check((A.db.entities['c3'] as Chore).price === (B.db.entities['c3'] as Chore).price, `цены сошлись: ${(A.db.entities['c3'] as Chore).price}`);

// новый телефон C получает дельту — должен заметить пробел
r = send(A, C);
check(r.type === 'gap', 'C без истории видит, что код неполный');
r = send(A, C, true);
check(r.type === 'ok' && Object.keys(C.db.entities).length === Object.keys(A.db.entities).length, 'полный код восстанавливает C');

// принятие сделки создаёт задачи; задачи отклонённой сделки не считаются
const d = A.db.entities['l1'] as any;
putLocal(A.db, A.dev, { ...d, status: 'accepted' });
for (let i = 0; i < 7; i++) putLocal(A.db, A.dev, { ...blank, id: 't' + i, kind: 'task', chore: 'c2', name: 'Дело 2', price: 3, who: 'm2', deal: 'l1', done: true, doneAt: 1, createdAt: i } as any);
send(A, B);
check(stats(B.db)['m2'].done === 21, `у B счёт Маши 21 (${stats(B.db)['m2'].done})`);
putLocal(B.db, B.dev, { ...(B.db.entities['l1'] as any), status: 'withdrawn' });
check(tasks(B.db).length === 0, 'задачи неактивной сделки не считаются');

// чужой дом
const D = { db: emptyDB(), dev: dev('dD') };
D.db.homeId = 'h2';
putLocal(D.db, D.dev, { ...blank, id: 'home', kind: 'home', homeId: 'h2', members: [] } as any);
r = send(D, A);
check(r.type === 'other-home', 'код другого дома распознан');

// кириллица и большие объёмы
for (let i = 0; i < 400; i++) putLocal(A.db, A.dev, { ...blank, id: 'x' + i, kind: 'task', chore: 'c1', name: 'Пропылесосить квартиру 🧹', price: 6, who: 'm1', deal: null, done: true, doneAt: i, createdAt: i } as any);
const big = encodeCode(buildPayload(A.db, A.dev, true));
console.log(`полный код на ${Object.keys(A.db.entities).length} записей: ${big.length} символов, ${framesFor(big, 'x').length} QR-кадров`);
r = importPayload(B.db, B.dev, decodeCode(big));
check(r.type === 'ok' && (B.db.entities['x5'] as any).name.endsWith('🧹'), 'эмодзи и кириллица переживают кодирование');

process.exit(ok ? 0 : 1);
