import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, LifeBuoy, Copy, Check } from 'lucide-react-native';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { getCurrency } from '../../data/currencies';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import {
  StatusBadge,
  getTxRef,
  TxSummaryCard,
  TxDetailsList,
  TxTimeline,
  isCardTx,
  isIncoming,
  shouldShowTimeline,
} from '../../components/TransactionView';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function HeroRef({ refValue }: { refValue: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Pressable onPress={onCopy} hitSlop={8} style={styles.heroInfoRow}>
      <Text style={styles.heroInfoLabel}>Reference</Text>
      <View style={styles.heroRefValue}>
        <Text style={styles.heroInfoValue}>{refValue}</Text>
        {copied
          ? <Check size={14} color={colors.success} strokeWidth={2.5} />
          : <Copy  size={14} color={colors.textMuted}   strokeWidth={2} />}
      </View>
    </Pressable>
  );
}

export default function TransactionDetailScreen({ route }: RootStackProps<'TransactionDetail'>) {
  const { txId, mode = 'detail' } = route.params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, wallets } = useWalletStore();
  const cards = useCardStore((s) => s.cards);

  const tx = transactions.find((t) => t.id === txId);

  const isReceipt = mode === 'receipt';

  const handleClose = () => {
    navigation.goBack();
  };

  if (!tx) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.navbar}>
          <Pressable onPress={handleClose} style={styles.navCloseBtn}>
            <X size={20} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Transaction not found.</Text>
        </View>
      </View>
    );
  }

  const wallet   = wallets.find((w) => w.id === tx.walletId);
  const card     = tx.cardId ? cards.find((c) => c.id === tx.cardId) : undefined;
  const firstName = tx.recipientName.split(' ')[0];
  const incoming = isIncoming(tx);
  const isCard   = isCardTx(tx);
  const absAmount = Math.abs(tx.amount);
  const heroCurrency = getCurrency(tx.currency);
  const heroSymbol = heroCurrency.symbol;
  const heroNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(absAmount);
  const showRecipientHero = !isCard && !incoming;
  const showReceivedHero  = !isCard && !incoming
    && !!tx.receivedAmount && !!tx.receiveCurrency
    && tx.receiveCurrency !== tx.currency;
  const receivedNumber = tx.receivedAmount
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tx.receivedAmount)
    : '';
  const receivedSymbol = tx.receiveCurrency ? getCurrency(tx.receiveCurrency).symbol : '';

  const isInstant = tx.eta === 'Instant' || !tx.eta;
  const timelineStatus = isReceipt
    ? (isInstant ? 'completed' : 'pending')
    : tx.status;
  const badgeVariant = isReceipt
    ? (isInstant ? 'completed' : 'inProgress')
    : tx.status;

  const showTimeline = shouldShowTimeline(tx);
  const showSummary  = !isCard && !incoming && tx.fee !== undefined;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>Transaction Details</Text>
        <Pressable onPress={handleClose} style={[styles.navCloseBtn, styles.navLeft]} hitSlop={8}>
          <X size={20} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <SecondaryButton onPress={() => {}} style={[styles.helpBtn, styles.navRight]}>
          <LifeBuoy size={13} color={colors.textPrimary} strokeWidth={2} />
          <Text style={styles.helpBtnText}>Help</Text>
        </SecondaryButton>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.badgeWrap}>
            <StatusBadge variant={badgeVariant} />
          </View>
          <View style={styles.heroAmountBlock}>
            <View style={styles.heroAmountRow}>
              <Text style={[styles.heroSymbol, tx.status === 'failed' && styles.heroAmountFailed]}>{heroSymbol}</Text>
              <Text style={[styles.heroAmount, tx.status === 'failed' && styles.heroAmountFailed]}>{heroNumber}</Text>
              <Text style={[styles.heroCode,   tx.status === 'failed' && styles.heroAmountFailed]}>{tx.currency}</Text>
            </View>
            {showReceivedHero && (
              <Text style={styles.heroReceived}>
                → {receivedSymbol}{receivedNumber} {tx.receiveCurrency}
              </Text>
            )}
          </View>
        </View>

        {/* ── Recipient + Ref rows ── */}
        <View style={styles.heroInfo}>
          {showRecipientHero && (
            <>
              <View style={styles.heroInfoRow}>
                <Text style={styles.heroInfoLabel}>To</Text>
                <Text style={styles.heroInfoValue}>{tx.recipientName}</Text>
              </View>
              <View style={styles.heroInfoDivider} />
            </>
          )}
          <HeroRef refValue={getTxRef(tx)} />
        </View>

        {/* ── Failed — refund notice ── */}
        {tx.status === 'failed' && (
          <View style={styles.refundBanner}>
            <Text style={styles.refundReason}>
              {tx.note ?? 'Transfer rejected by payment network'}
            </Text>
            <Text style={styles.refundText}>
              Your funds were not deducted. If you believe this is an error, tap Help.
            </Text>
          </View>
        )}

        {/* ── Timeline (outgoing P2P — promoted to top) ── */}
        {showTimeline && (
          <View style={[styles.section, !showSummary && styles.sectionLast]}>
            <Text style={styles.sectionLabel}>Transfer status</Text>
            <TxTimeline status={timelineStatus} firstName={firstName} txDate={tx.date} eta={tx.eta} />
          </View>
        )}

        {/* ── Summary (P2P outgoing with breakdown) ── */}
        {showSummary && (
          <View style={[styles.section, styles.sectionLast]}>
            <Text style={styles.sectionLabel}>Summary</Text>
            <TxSummaryCard tx={tx} />
          </View>
        )}

        {/* ── Details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Details</Text>
          <TxDetailsList tx={tx} wallet={wallet} card={card} />
        </View>

      </ScrollView>

      {/* ── Sticky footer CTA ── */}
      {(isReceipt || (!incoming && !isCard)) && (
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
              label={tx.status === 'failed' ? 'Try again' : 'Repeat transfer'}
              style={styles.footerBtn}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const H_PAD = 24;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingVertical: spacing.md,
  },
  navLeft: { zIndex: 1 },
  navRight: { zIndex: 1 },
  navCloseBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center', marginLeft: -6,
  },
  navTitle: {
    position: 'absolute', left: 0, right: 0,
    textAlign: 'center',
    fontSize: typography.md, fontWeight: typography.semibold, color: colors.textPrimary,
  },

  scroll: { paddingTop: spacing.sm },

  hero: {
    alignItems: 'center', paddingHorizontal: H_PAD,
    paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg,
  },
  badgeWrap: {},
  heroAmountBlock: { alignItems: 'center', gap: spacing.xs },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroSymbol: {
    fontSize: typography.lg, fontWeight: typography.bold,
    color: colors.textSecondary, paddingBottom: 3, marginRight: 2,
  },
  heroCode: {
    fontSize: typography.base, fontWeight: typography.semibold,
    color: colors.textSecondary, marginLeft: 6, paddingBottom: 4,
  },
  heroReceived: {
    fontSize: typography.sm, color: colors.textMuted,
    fontWeight: typography.medium, fontVariant: ['tabular-nums'],
  },
  heroAmountFailed: { color: colors.textMuted },
  heroAmount: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: colors.textPrimary, letterSpacing: -1,
  },

  heroInfo: {
    paddingHorizontal: H_PAD,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  heroInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md,
  },
  heroInfoDivider: { height: 1, backgroundColor: colors.borderSubtle },
  heroInfoLabel: {
    fontSize: typography.base, color: colors.textSecondary, flexShrink: 0,
  },
  heroInfoValue: {
    fontSize: typography.base, color: colors.textPrimary,
    fontWeight: typography.medium, textAlign: 'right',
  },
  heroRefValue: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },

  section: {
    paddingHorizontal: H_PAD,
    paddingTop: spacing.xl, paddingBottom: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  sectionLast: { paddingBottom: 0, borderBottomWidth: 0 },
  sectionLabel: {
    fontSize: typography.xs, color: colors.textSecondary,
    fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.lg,
  },

  refundBanner: {
    backgroundColor: colors.failedSubtle,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.failed + '33',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginHorizontal: H_PAD, marginTop: spacing.xl, marginBottom: 0,
    gap: spacing.xs,
  },
  refundReason: {
    fontSize: typography.base, fontWeight: typography.semibold,
    color: colors.failed, lineHeight: 22,
  },
  refundText: { fontSize: typography.sm, color: colors.failed, lineHeight: 20, opacity: 0.75 },

  helpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  helpBtnText: {
    fontSize: 11, fontWeight: typography.semibold, color: colors.textPrimary,
  },
  footer: {
    paddingHorizontal: H_PAD, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  footerBtn: {
    paddingVertical: spacing.lg,
  },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: typography.base, color: colors.textMuted },
});
