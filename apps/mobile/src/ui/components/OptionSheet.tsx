import { ScrollView } from 'react-native';

import { Button } from './Button';
import { ListRow } from './ListRow';
import { Sheet } from './Sheet';

export interface Option {
  readonly key: string;
  readonly label: string;
  readonly subtitle?: string | undefined;
}

export interface OptionSheetProps {
  visible: boolean;
  title: string;
  /** Names what the options will act on, when the title alone does not. */
  subtitle?: string | undefined;
  options: readonly Option[];
  onSelect: (key: string) => void;
  onCancel: () => void;
}

export function OptionSheet({
  visible,
  title,
  subtitle,
  options,
  onSelect,
  onCancel,
}: OptionSheetProps) {
  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onDismiss={onCancel}
      actions={<Button label="Cancel" onPress={onCancel} style={{ flex: 1 }} />}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {options.map((option) => (
          <ListRow
            key={option.key}
            title={option.label}
            subtitle={option.subtitle}
            onPress={() => {
              onSelect(option.key);
            }}
          />
        ))}
      </ScrollView>
    </Sheet>
  );
}
