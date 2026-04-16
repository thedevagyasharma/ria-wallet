import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RotateCcw } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import PrimaryButton from '../../components/PrimaryButton';
import FlatButton from '../../components/FlatButton';
import { useCardStore } from '../../stores/useCardStore';
import { useTabStore } from '../../stores/useTabStore';
import { getCurrency } from '../../data/currencies';
import { CardFront } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import AppleWalletBadge from '../../../assets/US-UK_Add_to_Apple_Wallet_RGB_101421.svg';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Add to Apple/Google Wallet button ───────────────────────────────────────
// Uses the official, unmodified badge artwork per each platform's brand
// guidelines. SVG for Apple (renders crisp at any scale via the SVG metro
// transformer), PNG for Google. In Expo Go the native PKAddPassButton isn't
// available, so the official artwork is the closest equivalent.

const GOOGLE_WALLET_BADGE = require('../../../assets/enUS_add_to_google_wallet_add-wallet-badge.png');

// Apple SVG is 110.739 × 35.016; Google PNG is 199 × 55. 48pt height keeps
// both above Apple's 44pt minimum and balances the PrimaryButton below.
// Widths derive from each asset's native aspect ratio.
const BADGE_HEIGHT = 48;
const APPLE_BADGE_WIDTH = BADGE_HEIGHT * (110.739 / 35.016);
const GOOGLE_BADGE_WIDTH = BADGE_HEIGHT * (199 / 55);

function AddToWalletButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.walletBtn, pressed && styles.walletBtnPressed]}
    >
      {Platform.OS === 'ios' ? (
        <AppleWalletBadge width={APPLE_BADGE_WIDTH} height={BADGE_HEIGHT} />
      ) : (
        <Image
          source={GOOGLE_WALLET_BADGE}
          style={{ width: GOOGLE_BADGE_WIDTH, height: BADGE_HEIGHT }}
          resizeMode="contain"
        />
      )}
    </Pressable>
  );
}

export default function AddCardReviewScreen({ route }: RootStackProps<'AddCardReview'>) {
  const navigation = useNavigation<Nav>();
  const { cardId } = route.params;
  const { cards } = useCardStore();
  const { wallets } = useWalletStore();

  const card = cards.find((c) => c.id === cardId);
  const wallet = wallets.find((w) => w.id === card?.walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;

  // Intro animation — matches WalletCardListScreen's card settle so the user
  // sees the same language when a new card first lands.
  const introProgress = useSharedValue(1);
  const opacity = useSharedValue(0);

  const runIntroAnimation = useCallback(() => {
    opacity.value = 0;
    introProgress.value = 1;
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    introProgress.value = withDelay(
      160,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
  }, [opacity, introProgress]);

  useEffect(() => {
    runIntroAnimation();
  }, [runIntroAnimation]);

  const handleReplayAnimation = () => {
    Haptics.selectionAsync();
    runIntroAnimation();
  };

  const cardAnimStyle = useAnimatedStyle(() => {
    const v = introProgress.value;
    return {
      transform: [
        { translateY: v * 28 },
        { scale: 1 + v * 0.08 },
      ],
    };
  });

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: introProgress.value * 28 }],
  }));

  // TODO: integrate PassKit (iOS) / Google Pay SDK (Android) for real wallet provisioning
  const handleAddToWallet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleViewDetails = () => {
    if (!card) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Rebuild the stack so back from CardDetail lands on the wallet's card list,
    // not the add-card flow the user just finished.
    navigation.dispatch(
      CommonActions.reset({
        index: 2,
        routes: [
          { name: 'Main' },
          { name: 'WalletCardList', params: { walletId: card.walletId } },
          { name: 'CardDetail', params: { cardId: card.id } },
        ],
      }),
    );
  };

  const handleDone = () => {
    if (!card) return;
    Haptics.selectionAsync();
    // Jump to the Wallets tab and fire the entrance signal now (not in
    // addCard) so the land-in animation plays when the user actually arrives
    // on Wallets, not back when the card was created mid-flow.
    useTabStore.getState().setActiveTabIdx(0);
    useCardStore.getState().markJustAdded(card.id);
    navigation.popToTop();
  };

  if (!card || !currency) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />

      {/* Prototype-only control: replay the entrance animation without
          re-running the entire add-card flow. Matches the "⚙ Prototype"
          section + segmented-control visual language on CardDetail /
          Confirmation. Stripped from production builds. */}
      {__DEV__ && (
        <View style={styles.protoWrap}>
          <Text style={styles.protoTitle}>⚙  Prototype</Text>
          <Pressable
            onPress={handleReplayAnimation}
            style={({ pressed }) => [styles.protoBtn, pressed && styles.protoBtnPressed]}
            hitSlop={8}
          >
            <RotateCcw size={12} color={colors.bg} strokeWidth={2.2} />
            <Text style={styles.protoBtnText}>Replay animation</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.content}>
        <Animated.View style={[styles.cardWrap, cardAnimStyle]}>
          <CardFront card={card} currency={currency.code} />
        </Animated.View>
        <Animated.View style={[styles.textWrap, textAnimStyle]}>
          <Text style={styles.title}>Card added!</Text>
          <Text style={styles.sub}>"{card.name}" is ready to use.</Text>
          <View style={styles.walletWrap}>
            <AddToWalletButton onPress={handleAddToWallet} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton onPress={handleViewDetails} label="View card details" style={styles.primaryBtn} />
        <FlatButton onPress={handleDone} label="Done" style={styles.doneBtn} />
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
  textWrap: { alignItems: 'center', gap: spacing.sm },
  title: { fontSize: typography.xxl, color: colors.textPrimary, fontWeight: typography.bold },
  sub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  walletWrap: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  walletBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBtnPressed: { opacity: 0.82 },

  // Prototype section — mirrors protoWrap/protoTitle + segActive styling from
  // CardDetail / Confirmation so it reads as the same dev surface. Floated
  // top-right because this screen has no scrollable area to host it inline.
  protoWrap: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  protoTitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  protoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.sm,
  },
  protoBtnPressed: { opacity: 0.8 },
  protoBtnText: {
    fontSize: typography.xs,
    color: colors.bg,
    fontWeight: typography.semibold,
  },
  primaryBtn: {
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
  },
  doneBtn: {
    paddingVertical: spacing.md,
  },
});
