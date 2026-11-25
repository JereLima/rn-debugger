import { addDebug, debugAsyncStorage, debugFirestore } from "rn-debugger/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fs as FirestoreFacade } from "@/lib/firebase";

addDebug({ reactDevTools: true }); // PRIMEIRA linha — antes de tudo
debugAsyncStorage(AsyncStorage);
// Instrumenta o Firestore — ATENÇÃO: passar a FACHADA MUTÁVEL (fs), não o módulo
// RNFB direto (exports getter-only, o patch não pega lá). As ops do CRUD
// aparecem nas abas Console ([fs]), Network (firestore://) e Firestore.
debugFirestore(FirestoreFacade, null);

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
