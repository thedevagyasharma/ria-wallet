import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, typography, radius } from '../theme';
import { getInitials } from '../utils/strings';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  name: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

const SIZE: Record<AvatarSize, { diameter: number; fontSize: number }> = {
  sm: { diameter: 32, fontSize: typography.xs },
  md: { diameter: 44, fontSize: typography.base },
  lg: { diameter: 48, fontSize: typography.md },
  xl: { diameter: 56, fontSize: typography.lg },
};

export default function Avatar({ name, size = 'md', style }: Props) {
  const { diameter, fontSize } = SIZE[size];
  return (
    <View
      style={[
        styles.base,
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        style,
      ]}
    >
      <Text style={[styles.initial, { fontSize }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.textSecondary,
    fontWeight: typography.semibold as '600',
  },
});
