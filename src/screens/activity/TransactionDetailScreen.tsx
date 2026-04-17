import React from 'react';
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
import { X, LifeBuoy } from 'lucide-react-native';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { getCurrency } from '../../data/currencies';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import {
  StatusBadge,
  TxSummaryCard,
  TxDetailsList,
  TxTimeline,
  isCardTx,
  isIncoming,
  shouldShowTimeline,
} from '../../components/TransactionView';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  const heroSymbol = getCurrency(tx.currency).symbol;
  const heroNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(absAmount);

  const isInstant = tx.eta === 'Instant' || !tx.eta;
  const timelineStatus = isReceipt
    ? (isInstant ? 'completed' : 'pending')
    : tx.status;
  const badgeVariant = isReceipt
    ? (isInstant ? 'completed' : 'inProgress')
    : tx.status;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <Pressable onPress={handleClose} style={styles.navCloseBtn} hitSlop={8}>
          <X size={20} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.navTitle}>Transaction Details</Text>
        <View style={{ width: 36 }} />
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

          <View style={styles.heroAmountRow}>
            <Text style={styles.heroSymbol}>{heroSymbol}</Text>
            <Text style={styles.heroAmount}>{heroNumber}</Text>
            <Text style={styles.heroSymbolBalance}>{heroSymbol}</Text>
          </View>
        </View>

        {/* ── Failed — refund notice ── */}
        {tx.status === 'failed' && (
          <View style={styles.refundBanner}>
            <Text style={styles.refundReason}>
              {tx.note ?? 'Transfer rejected by payment network'}
            </Text>
            <Text style={styles.refundText}>
              Your funds were not deducted. If you believe this is an error, use the button below to get help.
            </Text>
          </View>
        )}

        {/* ── Details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Details</Text>
          <TxDetailsList tx={tx} wallet={wallet} card={card} />
        </View>

        {/* ── Summary (P2P outgoing with breakdown) ── */}
        {!isCard && !incoming && tx.fee !== undefined && (
          <View style={[styles.section, !shouldShowTimeline(tx) && styles.sectionLast]}>
            <Text style={styles.sectionLabel}>Summary</Text>
            <TxSummaryCard tx={tx} />
          </View>
        )}

        {/* ── Timeline (outgoing P2P only) ── */}
        {shouldShowTimeline(tx) && (
          <View style={[styles.section, styles.sectionLast]}>
            <Text style={styles.sectionLabel}>Transfer status</Text>
            <TxTimeline status={timelineStatus} firstName={firstName} txDate={tx.date} />
          </View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          {isReceipt ? (
            <PrimaryButton
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              label="Share receipt"
              style={styles.actionBtn}
            />
          ) : (
            !incoming && !isCard && (
              <PrimaryButton
                onPress={() => navigation.navigate('SendMoney', {
                  walletId: tx.walletId,
                  contactName: tx.recipientName,
                  prefillSendAmount: Math.abs(tx.amount) - (tx.fee ?? 0),
                })}
                label="Repeat transfer"
                style={styles.actionBtn}
              />
            )
          )}
          <SecondaryButton onPress={() => {}} style={styles.helpBtn}>
            <LifeBuoy size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.helpBtnText}>Get help with this transaction</Text>
          </SecondaryButton>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const H_PAD = 24;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: H_PAD, paddingVertical: spacing.md,
  },
  navCloseBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center', marginLeft: -6,
  },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: typography.md, fontWeight: typography.semibold, color: colors.textPrimary,
  },

  scroll: { paddingTop: spacing.sm },

  hero: {
    alignItems: 'center', paddingHorizontal: H_PAD,
    paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md,
  },
  badgeWrap: { marginTop: -spacing.lg, marginBottom: spacing.sm },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroSymbol: {
    fontSize: typography.lg, fontWeight: typography.bold,
    color: colors.textSecondary, paddingBottom: 3, marginRight: 2,
  },
  heroSymbolBalance: {
    fontSize: typography.lg, fontWeight: typography.bold,
    opacity: 0, marginLeft: 2,
  },
  heroAmount: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: colors.textPrimary, letterSpacing: -1,
  },

  section: {
    paddingHorizontal: H_PAD, paddingBottom: spacing.xl,
    marginBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  sectionLast: { paddingBottom: 0, marginBottom: spacing.lg, borderBottomWidth: 0 },
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
    marginHorizontal: H_PAD, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  refundReason: {
    fontSize: typography.base, fontWeight: typography.semibold,
    color: colors.failed, lineHeight: 22,
  },
  refundText: { fontSize: typography.sm, color: colors.failed, lineHeight: 20, opacity: 0.75 },

  actions: {
    paddingHorizontal: H_PAD, paddingTop: spacing.md, gap: spacing.sm,
  },
  actionBtn: { paddingVertical: spacing.lg },
  helpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
  },
  helpBtnText: {
    fontSize: typography.base, fontWeight: typography.medium, color: colors.textSecondary,
  },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: typography.base, color: colors.textMuted },
});
