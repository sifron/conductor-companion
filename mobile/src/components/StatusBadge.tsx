import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../theme';

interface StatusBadgeProps {
  status: string | null;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { color: string; label: string; pulse: boolean }> = {
  working: { color: colors.accent, label: 'Working', pulse: true },
  idle: { color: colors.success, label: 'Idle', pulse: false },
  error: { color: colors.error, label: 'Error', pulse: false },
  'in-progress': { color: colors.accent, label: 'In Progress', pulse: true },
  ready: { color: colors.success, label: 'Ready', pulse: false },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const config = statusConfig[status || ''] || {
    color: colors.textMuted,
    label: status || 'Unknown',
    pulse: false,
  };

  useEffect(() => {
    if (config.pulse) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [config.pulse]);

  const dotSize = size === 'sm' ? 6 : 8;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: config.color,
            opacity: pulseAnim,
          },
        ]}
      />
      <Text
        style={[
          styles.label,
          { color: config.color, fontSize: size === 'sm' ? fonts.sizes.sm : fonts.sizes.md },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {},
  label: {
    fontWeight: '500',
  },
});
