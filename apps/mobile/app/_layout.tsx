import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FONTS } from '@/ui/fonts';
import { color } from '@/ui/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.background },
          headerTintColor: color.text,
          headerTitleStyle: { fontFamily: 'Fraunces_700Bold' },
          contentStyle: { backgroundColor: color.background },
        }}
      />
    </SafeAreaProvider>
  );
}
