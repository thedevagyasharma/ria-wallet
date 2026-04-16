import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../theme';
import BottomSheet from './BottomSheet';
import FlatButton from './FlatButton';

const AUTO_HIDE_SECONDS = 15;

export default function ViewPinSheet({
  visible,
  pin,
  onClose,
}: {
  visible: boolean;
  pin: string;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_HIDE_SECONDS);

  useEffect(() => {
    if (!visible) { setSecondsLeft(AUTO_HIDE_SECONDS); return; }
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.iconWrap}>
        <Shield size={26} color={colors.brand} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>Your PIN</Text>
      <Text style={styles.body}>
        Make sure no one can see your screen. Never share your PIN with anyone.
      </Text>
      <View style={styles.pinRow}>
        {pin.split('').map((digit, i) => (
          <View key={i} style={styles.pinBox}>
            <Text style={styles.pinDigit}>{digit}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.timer}>Auto-hides in {secondsLeft}s</Text>
      <FlatButton onPress={onClose} label="Close" style={styles.closeBtn} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
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
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  pinRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  pinBox: {
    width: 52,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigit: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    fontVariant: ['tabular-nums'],
  },
  timer: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  closeBtn: { width: '100%', paddingVertical: spacing.md },
});
