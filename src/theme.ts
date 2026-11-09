import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  bg: string; surface: string; sunk: string; ink: string; muted: string; line: string;
  accent: string; onAccent: string; ok: string; warn: string; bad: string; scrim: string;
  people: string[];
};

export const light: Theme = {
  dark: false,
  bg: '#EEF0F6', surface: '#FFFFFF', sunk: '#E4E7F0', ink: '#171A28', muted: '#5D6279', line: '#D6D9E4',
  accent: '#2E43E8', onAccent: '#FFFFFF', ok: '#14855F', warn: '#B07A06', bad: '#C23A2B', scrim: 'rgba(18,20,34,0.45)',
  people: ['#2E43E8', '#E85A2E', '#14946A', '#A13FCB'],
};

export const dark: Theme = {
  dark: true,
  bg: '#10121A', surface: '#191C28', sunk: '#222637', ink: '#ECEEF7', muted: '#9AA0B8', line: '#2C3043',
  accent: '#7F8CFF', onAccent: '#0E1020', ok: '#3FC793', warn: '#E2B23C', bad: '#FF6F5E', scrim: 'rgba(0,0,0,0.6)',
  people: ['#7F8CFF', '#FF8B5E', '#3FC793', '#CF7BF2'],
};

export const F = {
  display: 'DelaGothicOne_400Regular',
  body: 'GolosText_400Regular',
  medium: 'GolosText_500Medium',
  semi: 'GolosText_600SemiBold',
  num: 'JetBrainsMono_500Medium',
  numBold: 'JetBrainsMono_700Bold',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const personColor = (t: Theme, ids: string[], id: string) => {
  const i = ids.indexOf(id);
  return i < 0 ? t.muted : t.people[i % t.people.length];
};
