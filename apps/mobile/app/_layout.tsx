import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { log } from '@/observability';
import { ErrorBoundary } from '@/ui/components';
import { FONTS } from '@/ui/fonts';
import { color } from '@/ui/tokens';

/**
 * React Native's global error hook. Typed here rather than trusted from the ambient
 * declarations, which differ between versions.
 */
interface ErrorUtilsShape {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
}

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  useEffect(() => {
    const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
    if (errorUtils === undefined) return;

    // Anything that escapes a boundary still gets written down before the app goes.
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      log.error('app.crashed', error, { fatal: isFatal === true });
      previous(error, isFatal);
    });

    return () => {
      errorUtils.setGlobalHandler(previous);
    };
  }, []);

  useEffect(() => {
    // Hide on error too: a missing font should degrade to a system fallback, not
    // leave the user staring at a splash screen forever.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: color.background },
            headerTintColor: color.text,
            headerTitleStyle: { fontFamily: 'Fraunces_700Bold' },
            contentStyle: { backgroundColor: color.background },
          }}
        />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
