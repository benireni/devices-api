import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  /** Say what will actually happen, including anything that goes with it. */
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <Sheet
      visible={visible}
      title={title}
      onDismiss={onCancel}
      actions={
        <>
          <Button label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
          <Button label={confirmLabel} variant="danger" onPress={onConfirm} style={{ flex: 1 }} />
        </>
      }
    >
      <Text variant="body" tone="textMuted">
        {message}
      </Text>
    </Sheet>
  );
}
