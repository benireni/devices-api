import { StyleSheet, TextInput } from 'react-native';

import { color, radius, space, typography } from '../tokens';

export interface TextFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Monospaced, multi-line, no autocorrect — for editing ChordPro source. */
  source?: boolean;
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  source = false,
}: TextFieldProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={color.textMuted}
      autoFocus={autoFocus}
      multiline={source}
      autoCapitalize={source ? 'none' : 'sentences'}
      autoCorrect={!source}
      spellCheck={!source}
      style={[styles.base, source ? styles.source : styles.single]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  single: { ...typography.body, minHeight: 44, paddingVertical: space.sm },
  source: { ...typography.tab, flex: 1, paddingVertical: space.md, textAlignVertical: 'top' },
});
