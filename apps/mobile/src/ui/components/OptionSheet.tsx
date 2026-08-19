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
  options: readonly Option[];
  onSelect: (key: string) => void;
  onCancel: () => void;
}

export function OptionSheet({ visible, title, options, onSelect, onCancel }: OptionSheetProps) {
  return (
    <Sheet
      visible={visible}
      title={title}
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
