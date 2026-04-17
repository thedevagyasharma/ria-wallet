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
import FlagIcon from '../../components/FlagIcon';
import type { RootStackParamList } from '../../navigation/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
    return { wallet: w, currency, walletCards };
  });

  const allEmpty = walletGroups.every((g) => g.walletCards.length === 0);

  const handlePress = useCallback((walletId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CardList', { walletId });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cards</Text>
      </View>

      {allEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySub}>Add a card from any wallet to get started.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {walletGroups.map(({ wallet, currency, walletCards }) => (
            <View key={wallet.id} style={styles.walletBlock}>
              <Pressable
                onPress={() => handlePress(wallet.id)}
                style={({ pressed }) => [styles.walletHeader, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.walletHeaderLeft}>
                  <FlagIcon code={currency.flag} size={22} />
                  <View>
                    <Text style={styles.walletCurrency}>{currency.code}</Text>
                    <Text style={styles.walletName}>{currency.name}</Text>
                  </View>
                </View>
                <Text style={styles.walletCount}>
                  {walletCards.length} {walletCards.length === 1 ? 'card' : 'cards'}  →
                </Text>
              </Pressable>

              <CardStackPreview
                cards={walletCards}
                accent={colors.brand}
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
  walletFlag: {},
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
    color: colors.brand,
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
  emptyTitle: { fontSize: typography.xl, color: colors.textPrimary, fontWeight: typography.bold },
  emptySub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
