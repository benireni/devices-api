import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Newsreader_400Regular, Newsreader_500Medium } from '@expo-google-fonts/newsreader';

/**
 * Every font file the app loads, keyed by the family name the tokens refer to.
 *
 * Kept beside the tokens so adding a weight is one edit in each file and nowhere else.
 * Text renders as invisible until these resolve, which is why the root layout holds the
 * splash screen until loading settles.
 */
export const FONTS = {
  Fraunces_700Bold,
  Newsreader_400Regular,
  Newsreader_500Medium,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} as const;
