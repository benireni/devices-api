import { StyleSheet, TextInput } from 'react-native';

import { color, radius, space, typography } from '../tokens';

export interface TextFieldProps {
  /** A search field: iOS draws its own clear button while there is text in it. */
  search?: boolean;
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
  search = false,
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
      // iOS draws the clear button itself. Without it, abandoning a search means
      // backspacing a word one character at a time, one-handed.
      clearButtonMode={search ? 'while-editing' : 'never'}
      returnKeyType={search ? 'search' : 'default'}
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
