import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

import { ChevronLeft, ChevronRight, Globe, CreditCard, Hash } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../../theme';
import type { RootStackProps } from '../../navigation/types';
import type { CardType } from '../../stores/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type CardTypeOption = {
  type: CardType;
  icon: React.ReactNode;
  label: string;
  tagline: string;
  bullets: string[];
  fee?: string;
};

const sw = 1.8;
const OPTIONS: CardTypeOption[] = [
  {
    type: 'virtual',
    icon: <Globe size={22} color={colors.textSecondary} strokeWidth={sw} />,
    label: 'Virtual',
    tagline: 'Instant · Free',
    bullets: [
      'Online purchases & subscriptions',
      'Issued immediately',
      'Easy to freeze or delete',
    ],
  },
  {
    type: 'physical',
    icon: <CreditCard size={22} color={colors.textSecondary} strokeWidth={sw} />,
    label: 'Physical',
    tagline: 'Delivered in 5–7 days',
    fee: '$4.99 issuance fee',
    bullets: [
      'POS terminals & ATMs',
      'Contactless & chip+PIN',
      'Delivered to your address',
    ],
  },
  {
    type: 'single-use',
    icon: <Hash size={22} color={colors.textSecondary} strokeWidth={sw} />,
    label: 'Single-use',
    tagline: 'One-time payment · Free',
    bullets: [
      'Expires after one transaction',
      'Great for online checkouts',
      'Auto-deletes when used',
    ],
  },
];

export default function AddCardTypeScreen({ route }: RootStackProps<'AddCardType'>) {
  const navigation = useNavigation<Nav>();
  const { walletId } = route.params;

  const handleSelect = useCallback((type: CardType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (type === 'single-use') {
      navigation.navigate('SingleUseCreating', { walletId });
      return;
    }

    navigation.navigate('AddCardName', { walletId, cardType: type });
  }, [navigation, walletId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Card type</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>Choose the type of card you'd like to add to this wallet.</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.type}
            onPress={() => handleSelect(opt.type)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                {opt.icon}
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.label}>{opt.label}</Text>
                <Text style={styles.tagline}>{opt.tagline}</Text>
              </View>
              {opt.fee && (
                <View style={styles.feeBadge}>
                  <Text style={styles.feeText}>{opt.fee}</Text>
                </View>
              )}
            </View>
            <View style={styles.bullets}>
              {opt.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>·</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} style={styles.chevron} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  subtitle: { fontSize: typography.sm, color: colors.textSecondary, paddingHorizontal: spacing.xl, marginBottom: spacing.lg },

  list: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardPressed: { backgroundColor: colors.surfaceHigh },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  label: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  tagline: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  feeBadge: {
    backgroundColor: colors.pendingSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  feeText: { fontSize: typography.xs, color: colors.pending, fontWeight: typography.medium },

  bullets: { gap: 6 },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bulletDot: { color: colors.brand, fontSize: typography.base, lineHeight: 20 },
  bulletText: { fontSize: typography.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  chevron: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    marginTop: -9,
  },
});
