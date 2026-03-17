import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    color: colors.error,
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    maxHeight: 300,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.mono,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
