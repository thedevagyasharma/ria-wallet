import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '../theme';

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  label?: string;
  children?: React.ReactNode;
};

export default function FlatButton({ onPress, style, disabled, label, children }: Props) {
  const handlePress = () => {
    Haptics.selectionAsync();
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
      {label != null
        ? <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
