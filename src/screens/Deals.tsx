import React from 'react';
import { View } from 'react-native';
import { Deal, DealItem, STATUS_LABEL, ago, chores, deals, fairness, lotNumbers, members, sumItems } from '../model';
import { useStore } from '../store';
import { F, personColor, useTheme } from '../theme';
import { Beam, Btn, Dot, FairText, Section, T, useToast } from '../ui';

export function Deals({ onCounter }: { onCounter: (d: Deal) => void }) {
  const t = useTheme();
  const { db, device } = useStore();
  const all = deals(db);
  const lots = lotNumbers(db);
  const pend = all.filter((d) => d.status === 'pending');
  const toMe = pend.filter((d) => d.to === device.me);
  const fromMe = pend.filter((d) => d.from === device.me);
  const others = pend.filter((d) => d.to !== device.me && d.from !== device.me);
  const archive = all.filter((d) => d.status !== 'pending').slice(0, 12);

  const block = (label: string, list: Deal[]) =>
    list.length ? (
      <Section label={label}>
        {list.map((d) => <LotCard key={d.id} d={d} lot={lots[d.id]} onCounter={onCounter} />)}
      </Section>
    ) : null;

  return (
    <View style={{ gap: 22 }}>
      {block('Ждут вашего ответа', toMe)}
      {block('Ваши предложения', fromMe)}
      {block('Между другими', others)}
      {pend.length === 0 ? (
        <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 18, gap: 8 }}>
          <T v="h2">Открытых лотов нет</T>
          <T>Предложите обмен: что сделаете вы и что взамен сделает другой. Весы сразу покажут, честно ли.</T>
          <T v="small">Например: «Я мою посуду всю неделю (7 × 3 = 21), если ты один раз разберёшь балкон (20)».</T>
          {chores(db).length === 0 ? <T v="small">Сначала добавьте дела и цены на вкладке «Цены».</T> : null}
        </View>
      ) : null}
      {block('Архив', archive)}
    </View>
  );
}

function LotCard({ d, lot, onCounter }: { d: Deal; lot?: number; onCounter: (d: Deal) => void }) {
  const t = useTheme();
  const toast = useToast();
  const { db, device, actions } = useStore();
  const ms = members(db);
  const ids = ms.map((m) => m.id);
  const name = (id: string) => ms.find((m) => m.id === id)?.name ?? 'Кто-то';
  const a = sumItems(d.give);
  const b = sumItems(d.take);
  const f = fairness(a, b, name(d.from), name(d.to));
  const live = d.status === 'pending' || d.status === 'accepted';
  const statusColor = d.status === 'pending' ? t.warn : d.status === 'accepted' ? t.ok : t.muted;

  const side = (who: string, items: DealItem[]) => (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Dot color={personColor(t, ids, who)} />
        <T v="semi" style={{ fontSize: 14, flexShrink: 1 }}>{name(who)} сделает</T>
      </View>
      {items.length ? items.map((x) => (
        <View key={x.c} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <T style={{ fontSize: 14, flexShrink: 1 }}>{x.name}{x.n > 1 ? ` ×${x.n}` : ''}</T>
          <T v="num" color={t.muted}>{x.price * x.n}</T>
        </View>
      )) : <T v="small" style={{ fontStyle: 'italic' }}>ничего</T>}
    </View>
  );

  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 14, overflow: 'hidden', opacity: live ? 1 : 0.72 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
        <T style={{ fontFamily: F.display, fontSize: 15 }}>Лот №{lot ?? '—'}</T>
        <View style={{ flex: 1 }} />
        <T v="small" color={statusColor} style={{ fontFamily: F.semi }}>{STATUS_LABEL[d.status]}</T>
        <T v="small">{ago(d.createdAt)}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 5, overflow: 'hidden', paddingHorizontal: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 80 }, (_, i) => <View key={i} style={{ width: 6, height: 1.5, backgroundColor: t.line }} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingTop: 14 }}>
        {side(d.from, d.give)}
        {side(d.to, d.take)}
      </View>
      <Beam a={a} b={b} ca={personColor(t, ids, d.from)} cb={personColor(t, ids, d.to)} />
      <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}><FairText k={f.k} text={f.t} /></View>
      {d.note ? <T v="small" style={{ paddingHorizontal: 14, paddingTop: 4 }}>«{d.note}»</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 }}>
        {d.status === 'pending' && d.to === device.me ? (
          <>
            <Btn small kind="primary" title="Принять" onPress={() => { actions.acceptDeal(d.id); toast('Сделка принята. Обязательства — на вкладке «Дела».'); }} />
            <Btn small title="Встречное" onPress={() => onCounter(d)} />
            <Btn small kind="danger" title="Отказаться" onPress={() => actions.setDealStatus(d.id, 'declined')} />
          </>
        ) : null}
        {d.status === 'pending' && d.from === device.me ? (
          <Btn small kind="quiet" title="Отозвать" onPress={() => actions.setDealStatus(d.id, 'withdrawn')} />
        ) : null}
      </View>
    </View>
  );
}
