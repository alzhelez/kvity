import { DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one';
import { GolosText_400Regular, GolosText_500Medium, GolosText_600SemiBold } from '@expo-google-fonts/golos-text';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { chores, deals, members, tasks } from './src/model';
import { Composer, ComposerSeed, seedFromCounter } from './src/screens/Composer';
import { Deals } from './src/screens/Deals';
import { Prices } from './src/screens/Prices';
import { Score } from './src/screens/Score';
import { Setup } from './src/screens/Setup';
import { SyncSheet, SyncTab } from './src/screens/Sync';
import { Tasks } from './src/screens/Tasks';
import { StoreProvider, useStore } from './src/store';
import { F, useTheme } from './src/theme';
import { Dot, Sheet, T, ToastProvider } from './src/ui';

type Tab = 'deals' | 'tasks' | 'prices';

export default function App() {
  const [loaded] = useFonts({
    DelaGothicOne_400Regular, GolosText_400Regular, GolosText_500Medium, GolosText_600SemiBold,
    JetBrainsMono_500Medium, JetBrainsMono_700Bold,
  });
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ToastProvider>{loaded ? <Main /> : <Blank />}</ToastProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Blank() {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.bg }} />;
}

function Main() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { db, device, ready, actions } = useStore();
  const [tab, setTab] = useState<Tab>('deals');
  const [seed, setSeed] = useState<ComposerSeed>(null);
  const [seedKey, setSeedKey] = useState(0);
  const compose = (s: ComposerSeed) => { setSeedKey((k) => k + 1); setSeed(s); };
  const [sync, setSync] = useState<SyncTab | null>(null);
  const [pickMe, setPickMe] = useState(false);

  if (!ready) return <Blank />;

  const ms = members(db);
  const hasHome = ms.length > 0;
  const me = ms.find((m) => m.id === device.me);
  const meIdx = ms.findIndex((m) => m.id === device.me);
  const needMe = hasHome && !me;
  const incoming = deals(db).filter((d) => d.status === 'pending' && d.to === device.me).length;
  const myOpen = tasks(db).filter((x) => !x.done && x.who === device.me).length;
  const canDeal = hasHome && !!me && ms.length >= 2 && chores(db).length > 0;

  const TABS: [Tab, string, number][] = [['deals', 'Торг', incoming], ['tasks', 'Дела', myOpen], ['prices', 'Цены', 0]];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, paddingLeft: Math.max(16, insets.left), paddingRight: Math.max(16, insets.right), gap: 18 }}
        keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T style={{ fontFamily: F.display, fontSize: 30, lineHeight: 36, flex: 1 }} accessibilityRole="header">Квиты</T>
          {me ? (
            <Pressable onPress={() => setPickMe(true)} accessibilityRole="button" accessibilityLabel={`Вы — ${me.name}. Сменить`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Dot color={t.people[meIdx % 4]} />
              <T v="medium" style={{ fontSize: 14 }}>Я — {me.name}</T>
            </Pressable>
          ) : null}
          {hasHome ? (
            <Pressable onPress={() => setSync('show')} accessibilityRole="button" accessibilityLabel="Синхронизация"
              style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
              <T v="semi" style={{ fontSize: 14 }}>⇄ Синхр.</T>
            </Pressable>
          ) : null}
        </View>

        {!hasHome ? (
          <Setup onJoin={() => setSync('scan')} />
        ) : (
          <>
            <Score />
            <View style={{ flexDirection: 'row', backgroundColor: t.sunk, borderRadius: 12, padding: 4, gap: 4 }} accessibilityRole="tablist">
              {TABS.map(([id, label, badge]) => (
                <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)}
                  style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 9, backgroundColor: tab === id ? t.surface : 'transparent' }}>
                  <T v="semi" style={{ fontSize: 14 }} color={tab === id ? t.ink : t.muted}>{label}</T>
                  {badge ? (
                    <View style={{ minWidth: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: id === 'deals' ? t.bad : t.muted }}>
                      <T style={{ fontFamily: F.numBold, fontSize: 12, lineHeight: 18, textAlign: 'center' }} color="#FFFFFF">{badge}</T>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
            {tab === 'deals' ? <Deals onCounter={(d) => compose(seedFromCounter(d))} /> : null}
            {tab === 'tasks' ? <Tasks /> : null}
            {tab === 'prices' ? <Prices onPickMe={() => setPickMe(true)} onSync={() => setSync('show')} /> : null}
          </>
        )}
      </ScrollView>

      {canDeal ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16, alignItems: 'center' }}>
          <Pressable onPress={() => compose({})} accessibilityRole="button"
            style={({ pressed }) => ({ backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 15, opacity: pressed ? 0.85 : 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}>
            <T v="semi" color={t.onAccent} style={{ fontSize: 16 }}>Предложить сделку</T>
          </Pressable>
        </View>
      ) : null}

      {seed ? <Composer key={seedKey} seed={seed} onClose={() => setSeed(null)} /> : null}
      {sync !== null && !needMe ? <SyncSheet initialTab={sync} onClose={() => setSync(null)} /> : null}
      <Sheet visible={(pickMe || needMe) && sync === null} dismissable={!needMe} onClose={() => setPickMe(false)} title="Кто вы?">
        <T v="small">Выбор хранится только на этом телефоне. Каждый отмечает свои дела сам.</T>
        {ms.map((m, i) => (
          <Pressable key={m.id} accessibilityRole="button" onPress={() => { actions.setMe(m.id); setPickMe(false); if (needMe) setSync(null); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: m.id === device.me ? t.accent : t.line, backgroundColor: t.surface }}>
            <Dot color={t.people[i % 4]} size={12} />
            <T v="semi" style={{ fontSize: 17 }}>{m.name}</T>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
