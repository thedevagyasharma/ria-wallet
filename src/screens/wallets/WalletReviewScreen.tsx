import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import FlagIcon from '../../components/FlagIcon';
import { getCurrency } from '../../data/currencies';
import { useWalletStore } from '../../stores/useWalletStore';
import type { RootStackParamList } from '../../navigation/types';
import type { RootStackProps } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const H_PAD = 24;

export default function WalletReviewScreen({ route }: RootStackProps<'WalletReview'>) {
  const navigation = useNavigation<Nav>();
  const { currency: code, nickname, accentColor } = route.params;
  const currency = getCurrency(code);
  const { addWallet } = useWalletStore();

  const displayName = nickname && nickname !== code ? nickname : undefined;

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const walletId = `wallet-${code.toLowerCase()}-${Date.now()}`;
    addWallet({
      id: walletId,
      currency: code,
      balance: 0,
      isPrimary: false,
      nickname,
      accentColor,
    });
    navigation.navigate('WalletSuccess', { currency: code, walletId });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Review</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — flat, unboxed */}
        <View style={styles.hero}>
          <FlagIcon code={currency.flag} size={56} />
          <Text style={styles.currencyName}>{displayName ?? currency.name}</Text>
          <Text style={styles.currencyCode}>{currency.code}</Text>
        </View>

        {/* Details — flat section, inset hairlines */}
        <View style={[styles.section, styles.sectionLast]}>
          <Text style={styles.sectionLabel}>Details</Text>

          <DetailRow label="Starting balance" value={`0.00 ${code}`} />
          <View style={styles.rowDivider} />
          <DetailRow label="Wallet creation fee" value="Free" valueColor={colors.success} />
          <View style={styles.rowDivider} />
          <DetailRow label="Cards" value="Virtual & physical" />
        </View>

        <Text style={styles.note}>
          You can add virtual cards instantly or request a physical card for a small fee once the wallet is created.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton onPress={handleConfirm} style={styles.confirmBtn}>
          <Text style={styles.confirmBtnText}>Create {code} Wallet</Text>
        </PrimaryButton>
        <Pressable onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

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

  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.xl },

  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  currencyName: { fontSize: typography.xl, color: colors.textPrimary, fontWeight: typography.bold },
  currencyCode: { fontSize: typography.base, color: colors.textSecondary },

  // ── Flat section (decision 144) ──
  section: {
    paddingHorizontal: H_PAD,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sectionLast: {
    paddingBottom: 0,
    marginBottom: spacing.lg,
    borderBottomWidth: 0,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  detailLabel: { fontSize: typography.base, color: colors.textSecondary },
  detailValue: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  rowDivider: { height: 1, backgroundColor: colors.borderSubtle },

  note: {
    fontSize: typography.sm,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: H_PAD + spacing.sm,
    marginBottom: spacing.xl,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  confirmBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelBtnText: { fontSize: typography.base, color: colors.textSecondary },
});
