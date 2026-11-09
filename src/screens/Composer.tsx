import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Deal, DealItem, chores, fairness, members, pts, sumItems } from '../model';
import { useStore } from '../store';
import { F, personColor, useTheme } from '../theme';
import { Beam, Btn, Dot, FairText, Sheet, Stepper, T, useToast } from '../ui';

type Line = { c: string; n: number };
export type ComposerSeed = { to?: string; give?: DealItem[]; take?: DealItem[]; replyTo?: string | null } | null;

export function Composer({ seed, onClose }: { seed: ComposerSeed; onClose: () => void }) {
  const t = useTheme();
  const toast = useToast();
  const { db, device, actions } = useStore();
  const ms = members(db);
  const ids = ms.map((m) => m.id);
  const others = ms.filter((m) => m.id !== device.me);
  const list = chores(db);
  // Компонент монтируется заново для каждой сделки (key в App), поэтому начальное состояние берём из seed.
  const keep = (xs?: DealItem[]) => (xs ?? []).filter((x) => list.some((c) => c.id === x.c)).map((x) => ({ c: x.c, n: x.n }));
  const [to, setTo] = useState(seed?.to ?? others[0]?.id ?? '');
  const [give, setGive] = useState<Line[]>(() => keep(seed?.give));
  const [take, setTake] = useState<Line[]>(() => keep(seed?.take));
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState<'give' | 'take' | null>(null);

  const resolve = (ls: Line[]): DealItem[] =>
    ls.flatMap((l) => {
      const c = list.find((x) => x.id === l.c);
      return c ? [{ c: c.id, name: c.name, price: c.price, n: l.n }] : [];
    });
  const g = resolve(give);
  const k = resolve(take);
  const a = sumItems(g);
  const b = sumItems(k);
  const toName = ms.find((m) => m.id === to)?.name ?? '';
  const f = fairness(a, b, 'Вы', toName, true);

  const column = (side: 'give' | 'take', title: string, color: string, items: DealItem[], set: (fn: (l: Line[]) => Line[]) => void) => {
    const used = new Set(items.map((x) => x.c));
    const free = list.filter((c) => !used.has(c.id));
    return (
      <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Dot color={color} />
          <T v="semi">{title}</T>
        </View>
        {items.map((x, i) => (
          <View key={x.c} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T v="medium" style={{ flexShrink: 1 }}>{x.name}</T>
              <T v="num" style={{ fontFamily: F.numBold }}>{x.price * x.n}</T>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="small">{x.price} за раз</T>
              <Stepper
                value={x.n}
                max={30}
                labelLess={`Реже: ${x.name}`}
                labelMore={`Чаще: ${x.name}`}
                onChange={(v) => set((ls) => (v <= 0 ? ls.filter((_, j) => j !== i) : ls.map((l, j) => (j === i ? { ...l, n: v } : l))))}
              />
            </View>
          </View>
        ))}
        {adding === side ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {free.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => { set((ls) => [...ls, { c: c.id, n: 1 }]); setAdding(null); }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
                <T style={{ fontSize: 14 }}>{c.name} · {c.price}</T>
              </Pressable>
            ))}
            <Btn small kind="quiet" title="Отмена" onPress={() => setAdding(null)} />
          </View>
        ) : free.length ? (
          <Btn small kind="quiet" title="+ добавить дело" onPress={() => setAdding(side)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 }}>
          <T v="semi">Итого</T>
          <T v="num" style={{ fontFamily: F.numBold }}>{pts(side === 'give' ? a : b)}</T>
        </View>
      </View>
    );
  };

  const send = () => {
    if (!g.length && !k.length) return;
    actions.proposeDeal({ to, give: g, take: k, note: note.trim(), replyTo: seed?.replyTo ?? null });
    toast('Лот создан. Синхронизируйтесь с соседом, чтобы он его увидел.');
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={seed?.replyTo ? 'Встречное предложение' : 'Новая сделка'}>
      {others.length > 1 ? (
        <View style={{ gap: 6 }}>
          <T v="small">С кем торгуетесь</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {others.map((m) => (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: m.id === to }} onPress={() => setTo(m.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: m.id === to ? t.accent : t.line, backgroundColor: t.surface }}>
                <Dot color={personColor(t, ids, m.id)} />
                <T v="medium">{m.name}</T>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {column('give', 'Я сделаю', personColor(t, ids, device.me ?? ''), g, setGive)}
      {column('take', `${toName} сделает`, personColor(t, ids, to), k, setTake)}
      <Beam a={a} b={b} ca={personColor(t, ids, device.me ?? '')} cb={personColor(t, ids, to)} />
      <FairText k={f.k} text={f.t} />
      <View style={{ gap: 4 }}>
        <T v="small">Комментарий (необязательно)</T>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={200}
          multiline
          placeholder="Например: балкон до конца месяца"
          placeholderTextColor={t.muted}
          style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 64, color: t.ink, fontFamily: F.body, fontSize: 15, textAlignVertical: 'top' }}
        />
      </View>
      <Btn kind="primary" title={`Предложить: ${toName}`} disabled={!g.length && !k.length} onPress={send} />
    </Sheet>
  );
}

export const seedFromCounter = (d: Deal): ComposerSeed => ({ to: d.from, give: d.take, take: d.give, replyTo: d.id });
