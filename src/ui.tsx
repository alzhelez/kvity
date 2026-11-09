import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FairKind } from './model';
import { F, Theme, useTheme } from './theme';

/* ---------- текст ---------- */

type Variant = 'body' | 'medium' | 'semi' | 'small' | 'label' | 'h2' | 'display' | 'num' | 'numBig';

export function T({ v = 'body', color, style, ...rest }: TextProps & { v?: Variant; color?: string }) {
  const t = useTheme();
  const base: Record<Variant, TextStyle> = {
    body: { fontFamily: F.body, fontSize: 15, lineHeight: 21 },
    medium: { fontFamily: F.medium, fontSize: 15, lineHeight: 21 },
    semi: { fontFamily: F.semi, fontSize: 15, lineHeight: 21 },
    small: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: t.muted },
    label: { fontFamily: F.semi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: t.muted },
    h2: { fontFamily: F.semi, fontSize: 18, lineHeight: 24 },
    display: { fontFamily: F.display, fontSize: 24, lineHeight: 30 },
    num: { fontFamily: F.num, fontSize: 14, fontVariant: ['tabular-nums'] },
    numBig: { fontFamily: F.numBold, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
  };
  return <Text {...rest} style={[{ color: t.ink }, base[v], color ? { color } : null, style]} />;
}

/* ---------- кнопки ---------- */

export function Btn({
  title, onPress, kind = 'normal', disabled, style, small,
}: {
  title: string; onPress: () => void; kind?: 'normal' | 'primary' | 'quiet' | 'danger'; disabled?: boolean;
  style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'quiet' || kind === 'danger' ? 'transparent' : t.surface;
  const border = kind === 'primary' ? t.accent : kind === 'quiet' || kind === 'danger' ? 'transparent' : t.line;
  const color = kind === 'primary' ? t.onAccent : kind === 'danger' ? t.bad : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: 11, paddingHorizontal: small ? 12 : 16, paddingVertical: small ? 8 : 11, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        style,
      ]}>
      <Text style={{ color, fontFamily: F.semi, fontSize: small ? 14 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function IconBtn({ label, glyph, onPress, size = 34 }: { label: string; glyph: string; onPress: () => void; size?: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Text style={{ color: t.ink, fontFamily: F.semi, fontSize: 17, lineHeight: 20 }}>{glyph}</Text>
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99, labelLess = 'Меньше', labelMore = 'Больше' }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; labelLess?: string; labelMore?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <IconBtn label={labelLess} glyph="−" size={32} onPress={() => onChange(Math.max(min - 1, value - 1))} />
      <T v="num" style={{ minWidth: 24, textAlign: 'center', fontFamily: F.numBold, fontSize: 15 }}>{value}</T>
      <IconBtn label={labelMore} glyph="+" size={32} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}

export const Dot = ({ color, size = 10 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
);

/* ---------- блоки ---------- */

export function Rows({ children, t }: { children: React.ReactNode; t: Theme }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 14, overflow: 'hidden' }}>
      {items.map((c, i) => (
        <View key={i} style={[{ paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }]}>
          {c}
        </View>
      ))}
    </View>
  );
}

export const Section = ({ label, children, right }: { label?: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <View style={{ gap: 10 }}>
    {label ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="label">{label}</T>
        {right}
      </View>
    ) : null}
    {children}
  </View>
);

/* ---------- весы ---------- */

export function Beam({ a, b, ca, cb }: { a: number; b: number; ca: string; cb: string }) {
  const t = useTheme();
  const max = Math.max(a, b, 1);
  const deg = Math.max(-11, Math.min(11, ((b - a) / max) * 14)); // тяжелее — ниже
  const [anim] = useState(() => new Animated.Value(deg));
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) anim.setValue(deg);
      else Animated.spring(anim, { toValue: deg, friction: 5, tension: 70, useNativeDriver: true }).start();
    });
  }, [deg, anim]);
  const rotate = anim.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] });
  const pan = (side: 'l' | 'r', value: number, color: string) => (
    <View style={{ position: 'absolute', [side === 'l' ? 'left' : 'right']: -24, top: -30, width: 48, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontFamily: F.numBold, fontSize: 16, color }}>{value}</Text>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color }} />
    </View>
  );
  return (
    <View style={{ height: 68, marginHorizontal: 34, marginTop: 8 }} accessible accessibilityLabel={`Весы: ${a} против ${b}`}>
      <View style={{ position: 'absolute', left: '50%', top: 40, marginLeft: -13, width: 0, height: 0, borderLeftWidth: 13, borderRightWidth: 13, borderBottomWidth: 24, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: t.muted }} />
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 36, height: 4, borderRadius: 2, backgroundColor: t.ink, transform: [{ rotate }] }}>
        {pan('l', a, ca)}
        {pan('r', b, cb)}
      </Animated.View>
    </View>
  );
}

export function FairText({ k, text }: { k: FairKind; text: string }) {
  const t = useTheme();
  const color = k === 'ok' ? t.ok : k === 'warn' ? t.warn : k === 'bad' ? t.bad : t.muted;
  return <T v={k === 'muted' ? 'body' : 'semi'} color={color} style={{ textAlign: 'center', fontSize: 14 }}>{text}</T>;
}

/* ---------- лист (модальное окно) ---------- */

export function Sheet({ visible, onClose, title, children, dismissable = true, scroll = true }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; dismissable?: boolean; scroll?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={{ gap: 14, paddingHorizontal: Math.max(16, insets.left), paddingBottom: insets.bottom + 24 }}>{children}</View>
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={() => { if (dismissable) onClose(); }}>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: Platform.OS === 'ios' ? 8 : insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <T v="display" style={{ fontSize: 22, flex: 1 }}>{title}</T>
          {dismissable ? <IconBtn label="Закрыть" glyph="✕" onPress={onClose} /> : null}
        </View>
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
      </View>
    </Modal>
  );
}

/* ---------- тост ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const [op] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    Animated.timing(op, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null)), 3200);
    AccessibilityInfo.announceForAccessibility(m);
  }, [op]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 88, alignItems: 'center', opacity: op }}>
          <View style={{ backgroundColor: t.ink, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 520 }}>
            <Text style={{ color: t.bg, fontFamily: F.medium, fontSize: 14 }}>{msg}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
