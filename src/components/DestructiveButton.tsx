import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '../theme';

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  label?: string;
  children?: React.ReactNode;
};

export default function DestructiveButton({ onPress, style, disabled, label, children }: Props) {
  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {!disabled && (
        <>
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.00)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.insetTop} />
          <View style={styles.insetBottom} />
        </>
      )}
      {label != null
        ? <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.failed,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.failed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 4,
    elevation: 3,
  },
  pressed: {
    backgroundColor: '#b91c1c',
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    backgroundColor: colors.surfaceHigh,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: '#fff',
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  insetTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  insetBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
});
