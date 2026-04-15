import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import PrimaryButton from '../../components/PrimaryButton';
import { useCardStore } from '../../stores/useCardStore';
import { getCurrency } from '../../data/currencies';
import { CardFront } from '../../components/CardFace';
import type { RootStackProps } from '../../navigation/types';

export default function AddCardReviewScreen({ route }: RootStackProps<'AddCardReview'>) {
  const navigation = useNavigation();
  const { cardId } = route.params;
  const { cards } = useCardStore();
  const { wallets } = useWalletStore();

  const card = cards.find((c) => c.id === cardId);
  const wallet = wallets.find((w) => w.id === card?.walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 160 });
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // TODO: integrate PassKit (iOS) / Google Pay SDK (Android) for real wallet provisioning
  const handleAddToWallet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!card || !currency) return null;

  const walletLabel = Platform.OS === 'ios' ? 'Add to Apple Wallet' : 'Add to Google Wallet';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.content, animStyle]}>
        <View style={styles.cardWrap}>
          <CardFront card={card} currency={currency.code} />
        </View>
        <Text style={styles.title}>Card added!</Text>
        <Text style={styles.sub}>"{card.name}" is ready to use.</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable onPress={handleAddToWallet} style={styles.walletBtn}>
          <Text style={styles.walletBtnText}>{walletLabel}</Text>
        </Pressable>
        <PrimaryButton onPress={() => navigation.popToTop()} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Done</Text>
        </PrimaryButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  cardWrap: { marginBottom: spacing.md },
  title: { fontSize: typography.xxl, color: colors.textPrimary, fontWeight: typography.bold },
  sub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  walletBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  walletBtnText: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  doneBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
});
