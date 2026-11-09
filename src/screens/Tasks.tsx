import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Task, ago, chores, lotNumbers, members, pts, tasks } from '../model';
import { useStore } from '../store';
import { F, personColor, useTheme } from '../theme';
import { Btn, Dot, IconBtn, Rows, Section, T, useToast } from '../ui';

type Group = { key: string; name: string; price: number; deal: string | null; items: Task[] };

function openGroups(list: Task[], who: string): Group[] {
  const g = new Map<string, Group>();
  list
    .filter((t) => !t.done && t.who === who)
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((t) => {
      const k = `${t.deal ?? ''}|${t.name}|${t.price}`;
      if (!g.has(k)) g.set(k, { key: k, name: t.name, price: t.price, deal: t.deal, items: [] });
      g.get(k)!.items.push(t);
    });
  return [...g.values()];
}

export function Tasks() {
  const t = useTheme();
  const toast = useToast();
  const { db, device, actions } = useStore();
  const ms = members(db);
  const ids = ms.map((m) => m.id);
  const all = tasks(db);
  const lots = lotNumbers(db);
  const list = chores(db);
  const [pick, setPick] = useState<string | null>(null);

  const groupRows = (who: string, own: boolean) => {
    const gs = openGroups(all, who);
    if (!gs.length) return <Rows t={t}><T v="small">{own ? 'Все обещания выполнены' : 'Долгов нет'}</T></Rows>;
    return (
      <Rows t={t}>
        {gs.map((g) => (
          <React.Fragment key={g.key}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="medium">{g.name}{g.items.length > 1 ? <T v="medium" color={t.muted}> ×{g.items.length}</T> : null}</T>
              <T v="small">{g.deal ? `по лоту №${lots[g.deal] ?? '—'}` : 'без сделки'} · {g.price} за раз</T>
            </View>
            {own ? (
              <Btn small title="Сделано" onPress={() => { actions.markDone(g.items[0].id); toast(`+${pts(g.price)} за «${g.name}»`); }} />
            ) : (
              <T v="num" style={{ fontFamily: F.numBold }}>{g.price * g.items.length}</T>
            )}
          </React.Fragment>
        ))}
      </Rows>
    );
  };

  const done = all.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 25);

  return (
    <View style={{ gap: 22 }}>
      <Section label="Мои обязательства">{device.me ? groupRows(device.me, true) : null}</Section>
      {ms.filter((m) => m.id !== device.me).map((m) => (
        <Section key={m.id} label={`Обязательства: ${m.name}`}>{groupRows(m.id, false)}</Section>
      ))}

      {list.length ? (
        <Section label="Сделали что-то сверх сделок?">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {list.map((c) => {
              const on = pick === c.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPick(on ? null : c.id)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.surface }}>
                  <T style={{ fontSize: 14 }} color={on ? t.onAccent : t.ink}>{c.name} · {c.price}</T>
                </Pressable>
              );
            })}
          </View>
          <Btn
            kind="primary"
            title={pick ? 'Я сделал(а)' : 'Выберите дело выше'}
            disabled={!pick}
            onPress={() => {
              const c = list.find((x) => x.id === pick);
              if (!c) return;
              actions.quickDone(c.id);
              setPick(null);
              toast(`+${pts(c.price)} за «${c.name}»`);
            }}
          />
        </Section>
      ) : null}

      <Section label="История">
        {done.length ? (
          <Rows t={t}>
            {done.map((x) => {
              const m = ms.find((y) => y.id === x.who);
              return (
                <React.Fragment key={x.id}>
                  <Dot color={personColor(t, ids, x.who)} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="medium">{x.name}</T>
                    <T v="small">{m?.name ?? 'Кто-то'} · {ago(x.doneAt)}{x.deal ? ` · лот №${lots[x.deal] ?? '—'}` : ''}</T>
                  </View>
                  <T v="num" color={t.ok} style={{ fontFamily: F.numBold }}>+{x.price}</T>
                  {x.who === device.me ? <IconBtn label="Отменить отметку" glyph="↶" size={30} onPress={() => actions.undoTask(x.id)} /> : null}
                </React.Fragment>
              );
            })}
          </Rows>
        ) : (
          <Rows t={t}><T v="small">Пока ничего не сделано</T></Rows>
        )}
      </Section>
    </View>
  );
}
