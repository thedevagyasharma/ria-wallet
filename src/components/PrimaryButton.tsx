import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children: React.ReactNode;
};

export default function PrimaryButton({ onPress, style, disabled, children }: Props) {
  return (
    <Pressable
      onPress={onPress}
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
            colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.00)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.insetTop} />
          <View style={styles.insetBottom} />
        </>
      )}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#441306',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
  pressed: {
    backgroundColor: colors.brandDark,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    backgroundColor: colors.surfaceHigh,
    shadowOpacity: 0,
    elevation: 0,
  },
  insetTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 214, 167, 0.10)',
  },
  insetBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(126, 42, 12, 0.05)',
  },
});
