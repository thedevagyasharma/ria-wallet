import React from 'react';
import {
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children: React.ReactNode;
};

export default function FlatButton({ onPress, style, disabled, children }: Props) {
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
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.35,
  },
});
