import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { color, typography, type ColorRole, type TypeVariant } from '../tokens';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TypeVariant;
  tone?: ColorRole;
  /** Layout-only overrides. Typography and color must come from the tokens above. */
  style?: Pick<TextStyle, 'marginTop' | 'marginBottom' | 'textAlign' | 'flex'>;
}

/**
 * The only text primitive in the app.
 *
 * Size, weight and color are chosen from the token scales rather than passed as free
 * values, so a screen physically cannot introduce a fourteenth shade of grey.
 */
export function Text({ variant = 'body', tone = 'text', style, ...rest }: TextProps) {
  return (
    <RNText
      // Derived from the variant, in one place, so no screen has to remember. Without it
      // nothing in the app offered heading navigation — including sheets, whose titles
      // are the only thing identifying them.
      accessibilityRole={HEADINGS.has(variant) ? 'header' : undefined}
      {...rest}
      style={[typography[variant], { color: color[tone] }, style]}
    />
  );
}

const HEADINGS = new Set<TypeVariant>(['title', 'heading']);
