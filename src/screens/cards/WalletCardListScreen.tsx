import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { useCardStore } from '../../stores/useCardStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency } from '../../data/currencies';
import { CardFront, CARD_HEIGHT } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WalletCardListScreen({ route }: RootStackProps<'WalletCardList'>) {
  const navigation = useNavigation<Nav>();
  const { walletId } = route.params;
  const { cards } = useCardStore();
  const { wallets } = useWalletStore();

  const wallet = wallets.find((w) => w.id === walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;
  const walletCards = cards.filter((c) => c.walletId === walletId);

  const handleCardPress = useCallback((cardId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CardDetail', { cardId });
  }, [navigation]);

  const handleAddCard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AddCardType', { walletId });
  }, [navigation, walletId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>
          {currency ? `${currency.flag} ${currency.code}` : 'Cards'}
        </Text>
        <Pressable onPress={handleAddCard} style={styles.addBtn}>
          <Plus size={20} color={colors.brand} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {walletCards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySub}>Add a card to start spending from this wallet.</Text>
            <PrimaryButton onPress={handleAddCard} style={styles.emptyAddBtn}>
              <Text style={styles.emptyAddBtnText}>Add your first card</Text>
            </PrimaryButton>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>
              {walletCards.length} {walletCards.length === 1 ? 'card' : 'cards'}
            </Text>
            {walletCards.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => handleCardPress(card.id)}
                style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.9 }]}
              >
                <CardFront card={card} currency={currency?.code ?? ''} />
              </Pressable>
            ))}

            <Pressable
              onPress={handleAddCard}
              style={({ pressed }) => [styles.addCardRow, pressed && styles.addCardRowPressed]}
            >
              <View style={styles.addCardIcon}>
                <Plus size={18} color={colors.brand} strokeWidth={2} />
              </View>
              <Text style={styles.addCardText}>Add another card</Text>
            </Pressable>
          </>
        )}
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
  addBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },

  cardWrap: {
    position: 'relative',
  },
  addCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
  },
  addCardRowPressed: { backgroundColor: colors.surfaceHigh },
  addCardIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardText: {
    fontSize: typography.base,
    color: colors.brand,
    fontWeight: typography.semibold,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xxxl * 2,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.xl, color: colors.textPrimary, fontWeight: typography.bold },
  emptySub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyAddBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  emptyAddBtnText: { fontSize: typography.base, color: '#441306', fontWeight: typography.bold },
});
