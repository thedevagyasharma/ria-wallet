import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Zap, Pen } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import PrimaryButton from '../../components/PrimaryButton';
import { getCurrency, formatAmount } from '../../data/currencies';
import { MOCK_CONTACTS } from '../../data/mockData';
import { getRate, getFee, getETA } from '../../data/exchangeRates';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Transaction } from '../../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Breakdown row ────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  sub,
  valueColor,
  size = 'base',
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  size?: 'base' | 'lg';
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text
          style={[
            size === 'lg' ? styles.rowValueLg : styles.rowValue,
            valueColor ? { color: valueColor } : {},
          ]}
        >
          {value}
        </Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ConfirmationScreen({ route }: RootStackProps<'Confirmation'>) {
  const navigation = useNavigation<Nav>();
  const { walletId, contactId, amount, receiveCurrency } = route.params;
  const { wallets, deductBalance, addTransaction } = useWalletStore();

  const wallet = wallets.find((w) => w.id === walletId)!;
  const currency = getCurrency(wallet.currency);
  const contact = MOCK_CONTACTS.find((c) => c.id === contactId)!;
  const recipientCurrency = getCurrency(receiveCurrency);

  const rate = getRate(wallet.currency, receiveCurrency);
  const fee = getFee(amount, wallet.currency);
  const converted = amount * rate;
  const total = amount + fee;
  const eta = getETA(wallet.currency, receiveCurrency);

  const willFail = false; // set true to demo error state

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (willFail) {
      navigation.navigate('SendError', { reason: 'transfer_failed' });
      return;
    }
    if (total > wallet.balance) {
      navigation.navigate('SendError', { reason: 'insufficient_funds' });
      return;
    }

    const txRef = `RIA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      walletId,
      type: 'send',
      recipientName: contact.name,
      amount: -total,
      currency: wallet.currency,
      date: new Date(),
      status: 'completed',
    };

    deductBalance(walletId, total);
    addTransaction(tx);

    navigation.navigate('SendSuccess', {
      recipientName: contact.name,
      amount,
      currency: wallet.currency,
      receivedAmount: converted,
      receiveCurrency,
      eta,
      txRef,
    });
  }, [willFail, total, wallet, navigation, walletId, contact, deductBalance, addTransaction, amount, eta]);

  const convertedFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);

  const firstName = contact.name.split(' ')[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Confirm transfer</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Receive hero ── */}
        <View style={styles.hero}>
          <Text style={styles.heroFlag}>{contact.flag}</Text>
          <Text style={styles.heroLabel}>{firstName} receives</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmount}>
              {recipientCurrency.symbol}{convertedFormatted}
            </Text>
            <Text style={styles.heroAmountCode}>{receiveCurrency}</Text>
          </View>
          <View style={styles.etaChip}>
            <Zap size={12} color={colors.success} strokeWidth={2.5} />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        </View>

        {/* ── 2. Recipient identity ── */}
        <View style={styles.card}>
          <View style={styles.recipientRow}>
            <View style={styles.recipientAvatar}>
              <Text style={styles.recipientFlag}>{contact.flag}</Text>
            </View>
            <View style={styles.recipientDetails}>
              <Text style={styles.recipientName}>{contact.name}</Text>
              <Text style={styles.recipientPhone}>{contact.phone}</Text>
            </View>
          </View>
        </View>

        {/* ── 3. Transfer breakdown ── */}
        <View style={styles.card}>
          {/* From */}
          <Row label="From wallet" value={`${currency.flag}  ${currency.code}`} />
          <View style={styles.divider} />

          {/* Cost lines — send + fee only, no rate between them */}
          <Row label="You send" value={formatAmount(amount, wallet.currency)} />
          <View style={styles.divider} />
          <Row label="Transfer fee" value={formatAmount(fee, wallet.currency)} />

          {/* Total — visually separated */}
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total deducted</Text>
            <Text style={styles.totalValue}>{formatAmount(total, wallet.currency)}</Text>
          </View>

          {/* Rate footnote — informational, not a cost line */}
          <View style={styles.divider} />
          <View style={styles.rateFootnote}>
            <Text style={styles.rateFootnoteText}>
              1 {currency.code} = {rate.toFixed(4)} {receiveCurrency}
            </Text>
          </View>
        </View>

        {/* Edit link */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pen size={13} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.editBtnText}>Edit transfer</Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <PrimaryButton onPress={handleConfirm} style={styles.confirmBtn}>
          <View style={styles.confirmBtnInner}>
            <Text style={styles.confirmBtnLabel}>Confirm and send</Text>
            <Text style={styles.confirmBtnAmount}>{formatAmount(total, wallet.currency)}</Text>
          </View>
        </PrimaryButton>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  heroFlag: { fontSize: 48, marginBottom: spacing.xs },
  heroLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: typography.semibold,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroAmount: {
    fontSize: typography.hero,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    letterSpacing: -2,
  },
  heroAmountCode: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    paddingBottom: 6, // optical baseline alignment with hero number
  },

  // ── Cards ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },

  // ── Recipient row ──
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientFlag: { fontSize: 24 },
  recipientDetails: { flex: 1 },
  recipientName: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  recipientPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },

  // ── Breakdown rows ──
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowLabel: { fontSize: typography.base, color: colors.textSecondary },
  rowValue: { fontSize: typography.base, color: colors.textPrimary },
  rowValueLg: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  rowSub: { fontSize: typography.xs, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.borderSubtle },

  // ── Total row ──
  totalDivider: { height: 2, backgroundColor: colors.border },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceHigh,
  },
  totalLabel: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  totalValue: {
    fontSize: typography.lg,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    letterSpacing: -0.5,
  },

  // ── ETA chip (in hero) ──
  etaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.success,
    marginTop: spacing.sm,
  },
  etaText: { fontSize: typography.xs, color: colors.success, fontWeight: typography.semibold },

  // ── Rate footnote (bottom of breakdown card) ──
  rateFootnote: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  rateFootnoteText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },

  // ── Edit ──
  editBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  editBtnText: { fontSize: typography.sm, color: colors.textSecondary },

  // ── Footer CTA ──
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  confirmBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  confirmBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmBtnLabel: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
  confirmBtnAmount: {
    fontSize: typography.md,
    color: 'rgba(68,19,6,0.65)',
    fontWeight: typography.semibold,
  },
});
