import React from 'react';
import { View } from 'react-native';
import { members, pts, stats } from '../model';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Dot, T } from '../ui';

export function Score() {
  const t = useTheme();
  const { db, device } = useStore();
  const ms = members(db);
  const st = stats(db);
  const total = ms.reduce((s, m) => s + st[m.id].done, 0);
  const sorted = ms.slice().sort((a, b) => st[b.id].done - st[a.id].done);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];

  let verdict: string;
  let even = false;
  if (total === 0) verdict = 'Счёт 0 : 0. Первое сделанное дело откроет таблицу';
  else if (st[hi.id].done === st[lo.id].done) { verdict = 'Квиты'; even = true; }
  else if (ms.length === 2) verdict = `${hi.name} впереди на ${pts(st[hi.id].done - st[lo.id].done)}`;
  else verdict = `Больше всех сделал(а) ${hi.name}, меньше всех — ${lo.name}`;

  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 }} accessibilityLiveRegion="polite">
      <T v={even ? 'display' : 'h2'}>{verdict}</T>
      <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: t.sunk, gap: 2 }}>
        {ms.map((m, i) => (
          <View key={m.id} style={{ flexGrow: total === 0 ? 1 : st[m.id].done || 0.0001, backgroundColor: total === 0 ? t.line : t.people[i % 4], minWidth: 4 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
        {ms.map((m, i) => (
          <View key={m.id} style={{ width: ms.length > 2 ? '50%' : `${100 / ms.length}%`, gap: 2, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Dot color={t.people[i % 4]} />
              <T v="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{m.name}{m.id === device.me ? <T v="small"> (вы)</T> : null}</T>
            </View>
            <T v="numBig">{st[m.id].done}</T>
            <T v="small">{st[m.id].open ? `ещё обещано ${pts(st[m.id].open)}` : 'долгов нет'}</T>
          </View>
        ))}
      </View>
    </View>
  );
}
