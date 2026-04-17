import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { getCurrency } from '../../data/currencies';
import { CardFront } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddCardReviewScreen({ route }: RootStackProps<'AddCardReview'>) {
  const navigation = useNavigation<Nav>();
  const { cardId } = route.params;
  const { cards } = useCardStore();
  const { wallets } = useWalletStore();
  const navigated = useRef(false);

  const card = cards.find((c) => c.id === cardId);
  const wallet = wallets.find((w) => w.id === card?.walletId);
  const currency = wallet ? getCurrency(wallet.currency) : null;

  const cardProgress = useSharedValue(1);
  const cardOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const creatingOpacity = useSharedValue(1);

  const navigateToCardList = () => {
    if (navigated.current || !card) return;
    navigated.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    useCardStore.getState().markJustAdded(card.id);
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'CardList', params: { walletId: card.walletId } },
        ],
      }),
    );
  };

  useEffect(() => {
    // Phase 1: card materializes (0–500ms)
    cardOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    cardProgress.value = withDelay(
      80,
      withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
    textOpacity.value = withDelay(200, withTiming(1, { duration: 280 }));

    // Phase 2: "Creating..." fades out, checkmark pops in (900ms)
    creatingOpacity.value = withDelay(900, withTiming(0, { duration: 200 }));
    checkOpacity.value = withDelay(1000, withTiming(1, { duration: 200 }));
    checkScale.value = withDelay(
      1000,
      withSequence(
        withSpring(1.15, { damping: 8, stiffness: 200, mass: 0.6 }),
        withSpring(1, { damping: 12, stiffness: 180 }),
      ),
    );

    // Phase 3: navigate away (1700ms)
    const timer = setTimeout(() => {
      navigateToCardList();
    }, 1700);

    return () => clearTimeout(timer);
  }, []);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardProgress.value * 24 },
      { scale: 1 + cardProgress.value * 0.06 },
    ],
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: cardProgress.value * 16 }],
  }));

  const creatingStyle = useAnimatedStyle(() => ({
    opacity: creatingOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  if (!card || !currency) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.cardWrap, cardAnimStyle]}>
          <CardFront card={card} currency={currency.code} />
        </Animated.View>

        <Animated.View style={[styles.textWrap, textAnimStyle]}>
          <View style={styles.statusRow}>
            <Animated.View style={creatingStyle}>
              <Text style={styles.creating}>Creating your card...</Text>
            </Animated.View>
            <Animated.View style={[styles.checkWrap, checkStyle]}>
              <View style={styles.checkCircle}>
                <Check size={16} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.ready}>Card created</Text>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },

  cardWrap: { marginBottom: spacing.sm },

  textWrap: { alignItems: 'center' },

  statusRow: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  creating: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  checkWrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ready: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
});
