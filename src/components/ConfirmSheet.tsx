import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet from './BottomSheet';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import DestructiveButton from './DestructiveButton';
import FlatButton from './FlatButton';
import { colors, typography, spacing, radius } from '../theme';

type Props = {
  visible: boolean;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  confirmLabel: string;
  /** Use for irreversible / harmful actions (remove, report). Renders a DestructiveButton. */
  destructive?: boolean;
  /** Use for neutral/informational actions (dismiss, close). Renders a SecondaryButton. */
  secondary?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  /** Hide the secondary cancel button — use for single-action alert sheets. */
  hideCancelButton?: boolean;
};

export default function ConfirmSheet({
  visible, icon, iconBg,
  title, body,
  confirmLabel, destructive = false, secondary = false,
  onConfirm, onCancel,
  cancelLabel = 'Cancel',
  hideCancelButton = false,
}: Props) {
  const Btn = destructive ? DestructiveButton : secondary ? SecondaryButton : PrimaryButton;
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <View style={styles.actions}>
        <Btn onPress={onConfirm} label={confirmLabel} style={styles.btn} />
        {!hideCancelButton && (
          <FlatButton onPress={onCancel} label={cancelLabel} style={styles.cancelBtn} />
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  btn: {
    width: '100%',
    paddingVertical: spacing.lg,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: spacing.md,
  },
});
