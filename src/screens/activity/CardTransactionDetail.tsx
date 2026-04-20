import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, LifeBuoy } from 'lucide-react-native';
import SecondaryButton from '../../components/SecondaryButton';

import { colors, typography, spacing } from '../../theme';
import { getCurrency } from '../../data/currencies';
import { CATEGORY_META } from '../../utils/cardCategories';
import type { RootStackParamList } from '../../navigation/types';
import { StatusBadge, TxDetailsList } from '../../components/TransactionView';
import type { Transaction, Wallet, Card } from '../../stores/types';
import { H_PAD, sharedStyles } from './transactionDetailShared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  tx: Transaction;
  wallet?: Wallet;
  card?: Card;
};

export default function CardTransactionDetail({ tx, wallet, card }: Props) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const isFailed = tx.status === 'failed';
  const heroCurrency = getCurrency(tx.currency);
  const heroSymbol = heroCurrency.symbol;
  const heroNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Math.abs(tx.amount));

  const meta = CATEGORY_META[tx.category ?? 'other'];
  const CardIcon = meta.Icon;

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
          {(isFailed || tx.status === 'pending') && (
            <View style={styles.badgeWrap}>
              <StatusBadge variant={tx.status} />
            </View>
          )}
          <View style={[styles.iconWrap, { backgroundColor: isFailed ? colors.surfaceHigh : meta.bgColor }]}>
            <CardIcon size={28} color={isFailed ? colors.textMuted : meta.iconColor} strokeWidth={1.8} />
          </View>
          <Text style={[styles.merchant, isFailed && styles.merchantFailed]}>
            {tx.recipientName}
          </Text>
          <View style={styles.amountBlock}>
            <View style={styles.amountRow}>
              <Text style={[styles.amountSymbol, isFailed && styles.amountFailed]}>{heroSymbol}</Text>
              <Text style={[styles.amount,       isFailed && styles.amountFailed]}>{heroNumber}</Text>
              <Text style={[styles.amountCode,   isFailed && styles.amountFailed]}>{tx.currency}</Text>
            </View>
          </View>
        </View>

        {/* ── Failed notice ── */}
        {isFailed && (
          <View style={sharedStyles.refundBanner}>
            <Text style={sharedStyles.refundReason}>
              {tx.note ?? 'Payment declined'}
            </Text>
            <Text style={sharedStyles.refundText}>
              Your funds were not deducted. If you believe this is an error, tap Help.
            </Text>
          </View>
        )}

        {/* ── Details ── */}
        <View style={[sharedStyles.section, sharedStyles.sectionLast]}>
          <Text style={sharedStyles.sectionLabel}>Details</Text>
          <TxDetailsList tx={tx} wallet={wallet} card={card} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center', paddingHorizontal: H_PAD,
    paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg,
  },
  badgeWrap: { alignItems: 'center' },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  merchant: {
    fontSize: typography.lg, fontWeight: typography.semibold,
    color: colors.textPrimary, textAlign: 'center',
  },
  merchantFailed: { color: colors.textMuted },
  amountBlock: { alignItems: 'center' },
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
});
