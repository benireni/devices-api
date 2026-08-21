import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { log } from '@/observability';
import { space } from '../tokens';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface Props {
  children: ReactNode;
  /** Called when the user asks to try again, to reset whatever state caused the throw. */
  onReset?: (() => void) | undefined;
}

interface State {
  failed: boolean;
}

/**
 * The last line before a white screen.
 *
 * A malformed note that makes `ChartView` throw took the whole app down with no record
 * of why — at a rehearsal, with no laptop, which is the exact scenario the log viewer
 * exists for. Catching it here means the crash is written down and the user still has a
 * way back to the library.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('app.render.failed', error, { stack: info.componentStack ?? '' });
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.body}>
        <EmptyState
          title="Something broke"
          hint="The details are in the log viewer. Your notes are files on this device and are untouched."
        />
        <Button
          label="Try again"
          variant="primary"
          onPress={() => {
            this.setState({ failed: false });
            this.props.onReset?.();
          }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.lg, padding: space.lg },
});
