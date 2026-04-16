import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import FlagIcon from '../../components/FlagIcon';
import { getCurrency } from '../../data/currencies';
import { useWalletStore } from '../../stores/useWalletStore';
import type { RootStackParamList } from '../../navigation/types';
import type { RootStackProps } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WalletReviewScreen({ route }: RootStackProps<'WalletReview'>) {
  const navigation = useNavigation<Nav>();
  const { currency: code } = route.params;
  const currency = getCurrency(code);
  const { addWallet } = useWalletStore();

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newWallet = {
      id: `wallet-${code.toLowerCase()}-${Date.now()}`,
      currency: code,
      balance: 0,
      isPrimary: false,
    };
    addWallet(newWallet);
    navigation.navigate('WalletSuccess', { currency: code });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Review</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        {/* Currency display */}
        <View style={styles.currencyCard}>
          <FlagIcon code={currency.flag} size={56} />
          <Text style={styles.currencyName}>{currency.name}</Text>
          <Text style={styles.currencyCode}>{currency.code}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow label="Starting balance" value={`0.00 ${code}`} />
          <View style={styles.divider} />
          <DetailRow label="Wallet creation fee" value="Free" valueColor={colors.success} />
          <View style={styles.divider} />
          <DetailRow label="Cards" value="Virtual &amp; physical" />
        </View>

        <Text style={styles.note}>
          You can add virtual cards instantly or request a physical card for a small fee once the wallet is created.
        </Text>
      </View>

      {/* CTA */}
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
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : {}]}>
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

  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },

  currencyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  flag: {},
  currencyName: { fontSize: typography.xl, color: colors.textPrimary, fontWeight: typography.bold },
  currencyCode: { fontSize: typography.base, color: colors.textSecondary },

  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailLabel: { fontSize: typography.base, color: colors.textSecondary },
  detailValue: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  divider: { height: 1, backgroundColor: colors.borderSubtle },

  note: {
    fontSize: typography.sm,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
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
