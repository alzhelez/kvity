import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Home, members, plural } from '../model';
import { useStore } from '../store';
import { CodeError, FrameCollector, buildPayload, encodeCode, framesFor, randomId } from '../sync';
import { F, useTheme } from '../theme';
import { Btn, Sheet, T, useToast } from '../ui';

export type SyncTab = 'show' | 'scan' | 'paste';
type Outcome = { tone: 'ok' | 'warn' | 'bad'; text: string; showMine?: boolean } | null;

export function SyncSheet({ initialTab, onClose }: { initialTab: SyncTab; onClose: () => void }) {
  const t = useTheme();
  const [tab, setTab] = useState<SyncTab>(initialTab);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const tabs: [SyncTab, string][] = [['show', 'Мой код'], ['scan', 'Сканировать'], ['paste', 'Текстом']];
  return (
    <Sheet visible onClose={onClose} title="Синхронизация">
      <T v="small">Данные хранятся только на телефонах. Чтобы сверить счёт, покажите свой код соседу, а потом отсканируйте его код. Порядок не важен.</T>
      <View style={{ flexDirection: 'row', backgroundColor: t.sunk, borderRadius: 12, padding: 4, gap: 4 }} accessibilityRole="tablist">
        {tabs.map(([id, label]) => (
          <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => { setTab(id); setOutcome(null); }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: tab === id ? t.surface : 'transparent' }}>
            <T v="semi" style={{ fontSize: 14 }} color={tab === id ? t.ink : t.muted}>{label}</T>
          </Pressable>
        ))}
      </View>
      {outcome ? <OutcomeCard o={outcome} onShowMine={() => { setTab('show'); setOutcome(null); }} /> : null}
      {tab === 'show' ? <ShowCode /> : null}
      {tab === 'scan' && !outcome ? <Scan onOutcome={setOutcome} /> : null}
      {tab === 'paste' && !outcome ? <Paste onOutcome={setOutcome} /> : null}
      {tab !== 'show' && outcome ? <Btn title="Ещё один код" onPress={() => setOutcome(null)} /> : null}
    </Sheet>
  );
}

function OutcomeCard({ o, onShowMine }: { o: NonNullable<Outcome>; onShowMine: () => void }) {
  const t = useTheme();
  const c = o.tone === 'ok' ? t.ok : o.tone === 'warn' ? t.warn : t.bad;
  return (
    <View style={{ borderWidth: 1.5, borderColor: c, borderRadius: 14, padding: 14, gap: 10, backgroundColor: t.surface }} accessibilityLiveRegion="assertive">
      <T v="medium">{o.text}</T>
      {o.showMine ? <Btn kind="primary" small title="Показать мой код" onPress={onShowMine} style={{ alignSelf: 'flex-start' }} /> : null}
    </View>
  );
}

/* ---------- показать ---------- */

function ShowCode() {
  const t = useTheme();
  const toast = useToast();
  const { db, device } = useStore();
  const { width } = useWindowDimensions();
  const [full, setFull] = useState(Object.keys(device.peers).length === 0);
  const { code, count } = useMemo(() => {
    const p = buildPayload(db, device, full);
    return { code: encodeCode(p), count: p.items.length };
  }, [db, device, full]);
  const nFrames = framesFor(code, 'x').length;
  const size = Math.min(width - 64, 320);

  return (
    <View style={{ gap: 14 }}>
      <FramedQR key={code} code={code} size={size} />
      <T v="small" style={{ textAlign: 'center' }}>
        {nFrames > 1 ? `Код длинный, поэтому показывается ${nFrames} кадрами по очереди: держите экран перед камерой, пока соберутся все. ` : ''}
        {count ? `В коде ${count} ${plural(count, 'изменение', 'изменения', 'изменений')}.` : 'Новых изменений нет, но код всё равно стоит показать: сосед узнает, что у вас уже есть.'}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 14, padding: 14 }}>
        <View style={{ flex: 1 }}>
          <T v="medium">Полный код</T>
          <T v="small">Для нового телефона или если сосед видит «код неполный».</T>
        </View>
        <Switch value={full} onValueChange={setFull} accessibilityLabel="Полный код" trackColor={{ true: t.accent, false: t.line }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn style={{ flex: 1 }} title="Отправить текстом" onPress={() => Share.share({ message: code }).catch(() => {})} />
        <Btn style={{ flex: 1 }} title="Скопировать" onPress={async () => { await Clipboard.setStringAsync(code); toast('Код скопирован.'); }} />
      </View>
      <T v="small">Текстом удобно, если вы не рядом: отправьте код в мессенджер, а сосед вставит его на вкладке «Текстом».</T>
    </View>
  );
}

/** QR, который по кругу показывает кадры длинного кода. */
function FramedQR({ code, size }: { code: string; size: number }) {
  const t = useTheme();
  const [frames] = useState(() => framesFor(code, randomId(4)));
  const [i, setI] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % frames.length), 450);
    return () => clearInterval(id);
  }, [frames]);
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16 }} accessible accessibilityLabel="QR-код синхронизации">
        <QRCode value={frames[i]} size={size} ecl="L" color="#000000" backgroundColor="#FFFFFF" quietZone={0} />
      </View>
      {frames.length > 1 ? <T v="num" color={t.muted}>{i + 1} / {frames.length}</T> : null}
    </View>
  );
}

/* ---------- приём ---------- */

function useImport(onOutcome: (o: Outcome) => void) {
  const { db, actions } = useStore();
  return (raw: string) => {
    let res;
    try {
      res = actions.importCode(raw);
    } catch (e) {
      onOutcome({ tone: 'bad', text: e instanceof CodeError ? e.message : 'Не получилось прочитать код.' });
      return;
    }
    const home = res.payload.items.find((x): x is Home => x.kind === 'home');
    const nameOf = (id: string | null) => (home?.members ?? members(db)).find((m) => m.id === id)?.name;
    switch (res.type) {
      case 'ok': {
        const who = nameOf(res.member);
        const n = res.changed;
        onOutcome({
          tone: 'ok',
          showMine: true,
          text: `${n ? `Получено ${n} ${plural(n, 'изменение', 'изменения', 'изменений')}` : 'Новых изменений нет'}${who ? ` от: ${who}` : ''}. Теперь покажите свой код${who ? ` (${who})` : ' соседу'}, чтобы и у него всё сошлось.`,
        });
        return;
      }
      case 'self':
        onOutcome({ tone: 'warn', text: 'Это код с этого же телефона. Отсканируйте код соседа.' });
        return;
      case 'gap':
        onOutcome({ tone: 'warn', text: 'Код неполный: в нём только свежие изменения, а более старых на этом телефоне нет. Попросите соседа включить «Полный код» и показать его снова.' });
        return;
      case 'other-home':
        if (!res.full) {
          onOutcome({ tone: 'warn', text: 'Это код другого дома. Чтобы перейти в него, попросите полный код.' });
          return;
        }
        Alert.alert('Другой дом', 'На этом телефоне уже есть свои данные. Заменить их данными из кода? Текущий счёт с этого телефона удалится.', [
          { text: 'Отмена', style: 'cancel', onPress: () => onOutcome({ tone: 'warn', text: 'Данные не тронуты.' }) },
          { text: 'Заменить', style: 'destructive', onPress: () => { actions.adopt(res.payload); onOutcome({ tone: 'ok', text: 'Готово, теперь вы в этом доме.' }); } },
        ]);
        return;
    }
  };
}

function Scan({ onOutcome }: { onOutcome: (o: Outcome) => void }) {
  const t = useTheme();
  const [perm, request] = useCameraPermissions();
  const collector = useRef(new FrameCollector()).current;
  const [progress, setProgress] = useState({ got: 0, total: 0 });
  const busy = useRef(false);
  const handle = useImport(onOutcome);
  const { width } = useWindowDimensions();

  if (!perm) return <T v="small">Проверяю доступ к камере…</T>;
  if (!perm.granted) {
    return (
      <View style={{ gap: 10 }}>
        <T>Чтобы считать QR-код соседа, нужна камера. Снимки никуда не сохраняются.</T>
        {perm.canAskAgain ? <Btn kind="primary" title="Разрешить камеру" onPress={request} /> : <T v="small">Доступ запрещён в настройках телефона. Разрешите камеру для приложения или используйте вкладку «Текстом».</T>}
      </View>
    );
  }
  const side = Math.min(width - 32, 360);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ width: side, height: side, alignSelf: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (busy.current) return;
            const code = collector.add(data);
            const p = collector.progress;
            if (p.got !== progress.got || p.total !== progress.total) setProgress({ ...p });
            if (code) {
              busy.current = true;
              collector.reset();
              handle(code);
            }
          }}
        />
      </View>
      <T v="small" style={{ textAlign: 'center' }} color={progress.total ? t.ink : t.muted}>
        {progress.total > 1 ? `Собрано кадров: ${progress.got} из ${progress.total}` : 'Наведите камеру на код на экране соседа'}
      </T>
    </View>
  );
}

function Paste({ onOutcome }: { onOutcome: (o: Outcome) => void }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const handle = useImport(onOutcome);
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Вставьте код, который начинается с KVITY1."
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 120, maxHeight: 220, color: t.ink, fontFamily: F.num, fontSize: 13, textAlignVertical: 'top' }}
        accessibilityLabel="Код синхронизации"
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn style={{ flex: 1 }} title="Из буфера" onPress={async () => setText(await Clipboard.getStringAsync())} />
        <Btn style={{ flex: 1 }} kind="primary" title="Принять код" disabled={!text.trim()} onPress={() => handle(text)} />
      </View>
    </View>
  );
}
