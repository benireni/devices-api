import { useEffect, useState } from 'react';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { TextField } from './TextField';

export interface PromptSheetProps {
  visible: boolean;
  title: string;
  placeholder: string;
  initial?: string;
  /** Shown when the last submission was rejected. */
  error?: string | null;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptSheet({
  visible,
  title,
  placeholder,
  initial = '',
  error = null,
  submitLabel,
  onSubmit,
  onCancel,
}: PromptSheetProps) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  return (
    <Sheet
      visible={visible}
      title={title}
      onDismiss={onCancel}
      actions={
        <>
          <Button label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
          <Button
            label={submitLabel}
            variant="primary"
            disabled={value.trim() === ''}
            onPress={() => {
              onSubmit(value);
            }}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <TextField autoFocus value={value} onChangeText={setValue} placeholder={placeholder} />
      {error !== null && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
    </Sheet>
  );
}
