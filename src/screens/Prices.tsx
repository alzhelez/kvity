import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { chores, members } from '../model';
import { useStore } from '../store';
import { F, useTheme } from '../theme';
import { Btn, Dot, Rows, Section, Stepper, T, useToast } from '../ui';

export function Prices({ onPickMe, onSync }: { onPickMe: () => void; onSync: () => void }) {
  const t = useTheme();
  const toast = useToast();
  const { db, actions } = useStore();
  const list = chores(db);
  const ms = members(db);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('5');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const input = { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: t.ink, fontFamily: F.body, fontSize: 15 } as const;

  const add = () => {
    const n = name.trim();
    const p = Math.max(1, Math.min(99, parseInt(price, 10) || 0));
    if (!n) { toast('Введите название дела.'); return; }
    actions.addChore(n, p);
    setName('');
    setPrice('5');
  };

  return (
    <View style={{ gap: 22 }}>
      <Section label="Цена неприятности">
        <T v="small">Сколько баллов стоит сделать дело один раз. Чем противнее, тем дороже. Новые сделки берут цену на момент предложения.</T>
        <Rows t={t}>
          {list.length ? list.map((c) => (
            <React.Fragment key={c.id}>
              <T v="medium" style={{ flex: 1, minWidth: 0 }}>{c.name}</T>
              <Stepper
                value={c.price}
                labelLess={`Дешевле: ${c.name}`}
                labelMore={`Дороже: ${c.name}`}
                onChange={(v) => {
                  if (v < 1) {
                    Alert.alert('Убрать дело?', `«${c.name}» исчезнет из списка цен. Старые сделки и история останутся.`, [
                      { text: 'Отмена', style: 'cancel' },
                      { text: 'Убрать', style: 'destructive', onPress: () => actions.deleteChore(c.id) },
                    ]);
                  } else actions.setChorePrice(c.id, v);
                }}
              />
            </React.Fragment>
          )) : <T v="small">Список пуст. Добавьте первое дело ниже.</T>}
        </Rows>
        <T v="small">Чтобы убрать дело, уменьшите цену ниже 1.</T>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="small">Новое дело</T>
            <TextInput value={name} onChangeText={setName} placeholder="Например, полить цветы" placeholderTextColor={t.muted} maxLength={40} style={input} returnKeyType="done" onSubmitEditing={add} accessibilityLabel="Название нового дела" />
          </View>
          <View style={{ width: 72, gap: 4 }}>
            <T v="small">Баллы</T>
            <TextInput value={price} onChangeText={(s) => setPrice(s.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={[input, { textAlign: 'center', fontFamily: F.num }]} accessibilityLabel="Цена в баллах" />
          </View>
        </View>
        <Btn kind="primary" title="Добавить дело" onPress={add} />
      </Section>

      <Section label="Участники">
        <Rows t={t}>
          {ms.map((m, i) => (
            <React.Fragment key={m.id}>
              <Dot color={t.people[i % 4]} />
              <TextInput
                value={drafts[m.id] ?? m.name}
                onChangeText={(s) => setDrafts((d) => ({ ...d, [m.id]: s }))}
                onEndEditing={() => {
                  const v = (drafts[m.id] ?? m.name).trim();
                  if (v && v !== m.name) actions.renameMember(m.id, v);
                  setDrafts((d) => { const { [m.id]: _, ...rest } = d; return rest; });
                }}
                maxLength={24}
                style={{ flex: 1, color: t.ink, fontFamily: F.medium, fontSize: 15, paddingVertical: 2 }}
                accessibilityLabel={`Имя участника ${i + 1}`}
              />
            </React.Fragment>
          ))}
        </Rows>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn small title="Кто я на этом телефоне" onPress={onPickMe} />
          <Btn small title="Синхронизация" onPress={onSync} />
        </View>
      </Section>

      <Section label="Устройство">
        <Btn
          kind="danger"
          title="Стереть данные на этом телефоне"
          onPress={() =>
            Alert.alert('Стереть всё?', 'Данные удалятся только с этого телефона. Восстановить их можно полным кодом с телефона соседа.', [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Стереть', style: 'destructive', onPress: actions.resetAll },
            ])
          }
        />
      </Section>
    </View>
  );
}
