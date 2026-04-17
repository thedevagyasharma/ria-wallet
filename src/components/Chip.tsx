import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { typography, spacing, radius } from '../theme';

export const CHIP_SIZES = {
  sm: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  md: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
} as const;

type Props = {
  label: string;
  color: string;
  bg: string;
  size?: 'sm' | 'md';
  border?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Chip({
  label, color, bg, size = 'md', border = true, icon, style,
}: Props) {
  const s = CHIP_SIZES[size];
  return (
    <View style={[
      styles.base,
      {
        backgroundColor: bg,
        paddingVertical: s.paddingVertical,
        paddingHorizontal: s.paddingHorizontal,
      },
      border && { borderWidth: 1, borderColor: color },
      style,
    ]}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={[styles.label, { color, fontSize: s.fontSize, fontWeight: s.fontWeight }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  iconWrap: { marginRight: 3 },
  label: {},
});
