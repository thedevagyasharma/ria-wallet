import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, LifeBuoy, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';

import { colors, typography, spacing } from '../../theme';
import { getCurrency } from '../../data/currencies';
import type { RootStackParamList } from '../../navigation/types';
import {
  StatusBadge,
  TxSummaryCard, TxDetailsList, TxTimeline,
  isIncoming, shouldShowTimeline,
} from '../../components/TransactionView';
import type { Transaction, Wallet } from '../../stores/types';
import { H_PAD, sharedStyles } from './transactionDetailShared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  tx: Transaction;
  wallet?: Wallet;
  mode: 'detail' | 'receipt';
};

export default function WalletTransactionDetail({ tx, wallet, mode }: Props) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const isReceipt = mode === 'receipt';
  const incoming = isIncoming(tx);
  const isFailed = tx.status === 'failed';

  const heroCurrency = getCurrency(tx.currency);
  const heroSymbol = heroCurrency.symbol;
  const heroNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Math.abs(tx.amount));

  const showReceivedHero = !incoming
    && !!tx.receivedAmount && !!tx.receiveCurrency
    && tx.receiveCurrency !== tx.currency;
  const receivedNumber = tx.receivedAmount
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tx.receivedAmount)
    : '';
  const receivedSymbol = tx.receiveCurrency ? getCurrency(tx.receiveCurrency).symbol : '';

  const isInstant = tx.eta === 'Instant' || !tx.eta;
  const timelineStatus = isReceipt ? (isInstant ? 'completed' : 'pending') : tx.status;
  const badgeVariant   = isReceipt ? (isInstant ? 'completed' : 'inProgress') : tx.status;

  const showTimeline = shouldShowTimeline(tx);
  const showSummary  = !incoming && tx.fee !== undefined;
  const firstName    = tx.recipientName.split(' ')[0];

  return (
    <View style={[sharedStyles.safe, { paddingTop: insets.top }]}>
      {/* ── Navbar ── */}
      <View style={sharedStyles.navbar}>
        <Text style={sharedStyles.navTitle}>Transaction Details</Text>
        <Pressable onPress={() => navigation.goBack()} style={[sharedStyles.navCloseBtn, sharedStyles.navLeft]} hitSlop={8}>
          <X size={20} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <SecondaryButton onPress={() => {}} style={[sharedStyles.helpBtn, sharedStyles.navRight]}>
          <LifeBuoy size={13} color={colors.textPrimary} strokeWidth={2} />
          <Text style={sharedStyles.helpBtnText}>Help</Text>
        </SecondaryButton>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[sharedStyles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {(!incoming || tx.status === 'failed' || tx.status === 'pending') && (
            <View>
              <StatusBadge variant={badgeVariant} />
            </View>
          )}
          <View style={[styles.heroIcon, incoming ? styles.heroIconIncoming : isFailed ? styles.heroIconFailed : styles.heroIconOutgoing]}>
            {incoming
              ? <ArrowDownLeft size={28} color={colors.success}              strokeWidth={1.8} />
              : <ArrowUpRight  size={28} color={isFailed ? colors.textMuted : colors.failed} strokeWidth={1.8} />}
          </View>
          <Text style={[styles.heroName, isFailed && styles.amountFailed]}>{tx.recipientName}</Text>
          <View style={styles.amountBlock}>
            <View style={styles.amountRow}>
              <Text style={[styles.amountSymbol, isFailed && styles.amountFailed]}>{heroSymbol}</Text>
              <Text style={[styles.amount,       isFailed && styles.amountFailed]}>{heroNumber}</Text>
              <Text style={[styles.amountCode,   isFailed && styles.amountFailed]}>{tx.currency}</Text>
            </View>
            {showReceivedHero && (
              <Text style={styles.heroReceived}>
                → {receivedSymbol}{receivedNumber} {tx.receiveCurrency}
              </Text>
            )}
          </View>
        </View>

        {/* ── Failed notice ── */}
        {isFailed && (
          <View style={sharedStyles.refundBanner}>
            <Text style={sharedStyles.refundReason}>
              {tx.note ?? 'Transfer rejected by payment network'}
            </Text>
            <Text style={sharedStyles.refundText}>
              Your funds were not deducted. If you believe this is an error, tap Help.
            </Text>
          </View>
        )}

        {/* ── Timeline ── */}
        {showTimeline && (
          <View style={[sharedStyles.section, !showSummary && sharedStyles.sectionLast]}>
            <Text style={sharedStyles.sectionLabel}>Transfer status</Text>
            <TxTimeline status={timelineStatus} firstName={firstName} txDate={tx.date} eta={tx.eta} />
          </View>
        )}

        {/* ── Summary ── */}
        {showSummary && (
          <View style={[sharedStyles.section, sharedStyles.sectionLast]}>
            <Text style={sharedStyles.sectionLabel}>Summary</Text>
            <TxSummaryCard tx={tx} />
          </View>
        )}

        {/* ── Details ── */}
        <View style={[sharedStyles.section, sharedStyles.sectionLast]}>
          <Text style={sharedStyles.sectionLabel}>Details</Text>
          <TxDetailsList tx={tx} wallet={wallet} />
        </View>
      </ScrollView>

      {/* ── Sticky footer CTA ── */}
      {(isReceipt || !incoming) && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {isReceipt ? (
            <PrimaryButton
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              label="Share receipt"
              style={styles.footerBtn}
            />
          ) : (
            <PrimaryButton
              onPress={() => navigation.navigate('SendMoney', {
                walletId: tx.walletId,
                contactName: tx.recipientName,
                prefillSendAmount: Math.abs(tx.amount) - (tx.fee ?? 0),
              })}
              label={isFailed ? 'Try again' : 'Repeat transfer'}
              style={styles.footerBtn}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center', paddingHorizontal: H_PAD,
    paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg,
  },
  amountBlock: { alignItems: 'center', gap: spacing.xs },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  amountSymbol: {
    fontSize: typography.lg, fontWeight: typography.bold,
    color: colors.textSecondary, paddingBottom: 3, marginRight: 2,
  },
  amount: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: colors.textPrimary, letterSpacing: -1,
  },
  amountCode: {
    fontSize: typography.base, fontWeight: typography.semibold,
    color: colors.textSecondary, marginLeft: 6, paddingBottom: 4,
  },
  amountFailed: { color: colors.textMuted },
  heroIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  heroIconIncoming: { backgroundColor: colors.successSubtle },
  heroIconOutgoing: { backgroundColor: colors.failedSubtle },
  heroIconFailed:   { backgroundColor: colors.surfaceHigh },
  heroName: {
    fontSize: typography.lg, fontWeight: typography.semibold,
    color: colors.textPrimary, textAlign: 'center',
  },
  heroReceived: {
    fontSize: typography.sm, color: colors.textMuted,
    fontWeight: typography.medium, fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingHorizontal: H_PAD, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  footerBtn: { paddingVertical: spacing.lg },
});
