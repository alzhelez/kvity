import React, { useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { F, useTheme } from '../theme';
import { Btn, Dot, Section, T, useToast } from '../ui';

const PH = ['Например, Саша', 'Например, Маша', 'Третий сосед', 'Четвёртый сосед'];

export function Setup({ onJoin }: { onJoin: () => void }) {
  const t = useTheme();
  const toast = useToast();
  const { actions } = useStore();
  const [names, setNames] = useState(['', '']);
  const [me, setMe] = useState(0);
  const [starter, setStarter] = useState(true);

  const create = () => {
    const filled = names.map((s) => s.trim());
    const idx = filled.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) { toast('Нужно хотя бы два имени.'); return; }
    const meIdx = idx.indexOf(me);
    actions.createHome(idx.map((i) => filled[i]), meIdx < 0 ? 0 : meIdx, starter);
  };

  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 8 }}>
        <T v="h2">Аукцион домашних дел</T>
        <T color={t.muted}>У каждого дела есть цена неприятности в баллах. Вы обмениваетесь делами, а весы и счёт показывают, честно ли всё поделено.</T>
      </View>

      <Section label="Новый дом">
        <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 14 }}>
          {names.map((v, i) => (
            <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 6 }, i > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
              <Dot color={t.people[i]} />
              <TextInput
                value={v}
                onChangeText={(s) => setNames((ns) => ns.map((x, j) => (j === i ? s : x)))}
                placeholder={PH[i]}
                placeholderTextColor={t.muted}
                maxLength={24}
                style={{ flex: 1, paddingVertical: 8, color: t.ink, fontFamily: F.medium, fontSize: 16 }}
                accessibilityLabel={`Имя ${i + 1}`}
              />
            </View>
          ))}
        </View>
        {names.length < 4 ? <Btn small kind="quiet" title="+ Ещё сосед" onPress={() => setNames((ns) => [...ns, ''])} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}

        <T v="small">Кто из вас держит этот телефон?</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {names.map((v, i) => (
            <Pressable key={i} accessibilityRole="radio" accessibilityState={{ selected: me === i }} onPress={() => setMe(i)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: me === i ? t.accent : t.line, backgroundColor: t.surface }}>
              <Dot color={t.people[i]} />
              <T v="medium">{v.trim() || `Участник ${i + 1}`}</T>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T v="medium">Стартовый список дел</T>
            <T v="small">Посуда, мусор, полы, балкон и другие. Цены потом можно поменять.</T>
          </View>
          <Switch value={starter} onValueChange={setStarter} trackColor={{ true: t.accent, false: t.line }} accessibilityLabel="Стартовый список дел" />
        </View>
        <Btn kind="primary" title="Создать дом" onPress={create} />
      </Section>

      <Section label="Уже пользуетесь на другом телефоне?">
        <T v="small">Попросите соседа открыть «Синхронизация → Мой код» с включённым полным кодом и отсканируйте его.</T>
        <Btn title="Присоединиться по коду" onPress={onJoin} />
      </Section>
    </View>
  );
}
