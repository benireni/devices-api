import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { color, radius, space } from '../tokens';
import { Text } from './Text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** `primary` is the identity green; use at most one per screen. */
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: Pick<ViewStyle, 'marginTop' | 'marginBottom' | 'alignSelf' | 'flex'>;
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  style,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text variant="caption" tone={variant === 'primary' ? 'background' : toneFor(variant)}>
        {label}
      </Text>
    </Pressable>
  );
}

function toneFor(variant: 'secondary' | 'danger') {
  return variant === 'danger' ? ('danger' as const) : ('accent' as const);
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: color.accent },
  secondary: { borderWidth: 1, borderColor: color.border },
  danger: { borderWidth: 1, borderColor: color.danger },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
