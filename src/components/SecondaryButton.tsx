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
import { colors, radius, typography } from '../theme';

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  shape?: 'pill' | 'rect';
  label?: string;
  children?: React.ReactNode;
};

export default function SecondaryButton({ onPress, style, disabled, shape = 'pill', label, children }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        shape === 'rect' && styles.rect,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {!disabled && (
        <>
          <LinearGradient
            colors={['rgba(255,255,255,0.60)', 'rgba(255,255,255,0.00)']}
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
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#18181b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  rect: {
    borderRadius: radius.lg,
  },
  pressed: {
    backgroundColor: colors.surfaceHigh,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  insetTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.80)',
  },
  insetBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
