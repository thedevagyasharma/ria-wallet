import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius } from '../../theme';
import { useCardStore } from '../../stores/useCardStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency } from '../../data/currencies';
import CardStackPreview from '../../components/CardStackPreview';
import type { RootStackParamList } from '../../navigation/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};
function walletAccent(c: string) { return WALLET_ACCENTS[c] ?? colors.brand; }

export default function AllCardsScreen() {
  const navigation = useNavigation<Nav>();
  const { cards } = useCardStore();
  const { wallets } = useWalletStore();
  const scrollRef = useRef<ScrollView>(null);
  const scrollReset = useTabScrollReset();
  useEffect(() => {
    if (scrollReset > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollReset]);

  const walletGroups = wallets.map((w) => {
    const walletCards = cards.filter((c) => c.walletId === w.id);
    const currency = getCurrency(w.currency);
    return { wallet: w, currency, walletCards, accent: walletAccent(w.currency) };
  });

  const allEmpty = walletGroups.every((g) => g.walletCards.length === 0);

  const handlePress = useCallback((walletId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WalletCardList', { walletId });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cards</Text>
      </View>

      {allEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySub}>Add a card from any wallet to get started.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {walletGroups.map(({ wallet, currency, walletCards, accent }) => (
            <View key={wallet.id} style={styles.walletBlock}>
              <Pressable
                onPress={() => handlePress(wallet.id)}
                style={({ pressed }) => [styles.walletHeader, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.walletHeaderLeft}>
                  <Text style={styles.walletFlag}>{currency.flag}</Text>
                  <View>
                    <Text style={styles.walletCurrency}>{currency.code}</Text>
                    <Text style={styles.walletName}>{currency.name}</Text>
                  </View>
                </View>
                <Text style={[styles.walletCount, { color: accent }]}>
                  {walletCards.length} {walletCards.length === 1 ? 'card' : 'cards'}  →
                </Text>
              </Pressable>

              <CardStackPreview
                cards={walletCards}
                accent={accent}
                onPress={() => handlePress(wallet.id)}
                showHeader={false}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },

  scroll: {
    paddingBottom: spacing.xxxl,
  },

  walletBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  walletHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walletFlag: { fontSize: 22 },
  walletCurrency: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  walletName: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  walletCount: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.xxxl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.xl, color: colors.textPrimary, fontWeight: typography.bold },
  emptySub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
