import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { getCurrency } from '../../data/currencies';
import { MOCK_PROFILE } from '../../data/mockData';
import { CardFront } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Props = RootStackProps<'AddCardReview'> | RootStackProps<'SingleUseCreating'>;

function isSingleUse(params: Props['route']['params']): params is { walletId: string } {
  return 'walletId' in params && !('cardId' in params);
}

export default function AddCardReviewScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const singleUse = isSingleUse(route.params);
  const { addCard, cards } = useCardStore();
  const { wallets } = useWalletStore();
  const navigated = useRef(false);
  const cardIdRef = useRef<string | null>(
    singleUse ? null : (route.params as { cardId: string }).cardId,
  );
  const walletIdRef = useRef<string>(
    singleUse
      ? (route.params as { walletId: string }).walletId
      : cards.find((c) => c.id === (route.params as { cardId: string }).cardId)?.walletId ?? '',
  );

  useEffect(() => {
    if (isSingleUse(route.params)) {
      const networks = ['Visa', 'Mastercard'] as const;
      const network = networks[Math.floor(Math.random() * networks.length)];
      const last4 = String(Math.floor(1000 + Math.random() * 9000));
      const prefix = network === 'Visa' ? '4' : '5';
      const g1 = prefix + Math.random().toString().slice(2, 5);
      const g2 = Math.random().toString().slice(2, 6);
      const g3 = Math.random().toString().slice(2, 6);
      const fullNumber = `${g1} ${g2} ${g3} ${last4}`;
      const month = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
      const year = String(27 + Math.floor(Math.random() * 4));
      const cardId = `card-${Date.now()}`;
      cardIdRef.current = cardId;

      addCard({
        id: cardId,
        walletId: route.params.walletId,
        name: 'Single-use card',
        color: '#f97316',
        branded: false,
        finish: 'plastic',
        last4,
        network,
        cardholderName: MOCK_PROFILE.name,
        expiry: `${month}/${year}`,
        cvv: String(Math.floor(100 + Math.random() * 900)),
        fullNumber,
        frozen: false,
        badgeTheme: 'default',
        type: 'single-use',
      });
    }
  }, []);

  const card = cardIdRef.current ? cards.find((c) => c.id === cardIdRef.current) : null;
  const wallet = wallets.find((w) => w.id === walletIdRef.current);
  const currencyCode = wallet ? getCurrency(wallet.currency)?.code ?? 'USD' : 'USD';

  const TOTAL_DURATION = 6000;
  const steps = [
    'Creating your card…',
    'Setting up security…',
    'Configuring limits…',
    'Almost there…',
  ];
  const stepDurations = [1300, 1500, 1400, 1300];
  const [stepIndex, setStepIndex] = useState(0);
  const done = stepIndex >= steps.length;

  const cardProgress = useSharedValue(1);
  const cardOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const stepOpacity = useSharedValue(1);
  const stepY = useSharedValue(0);
  const barWidth = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const barOpacity = useSharedValue(1);

  const navigateToCardList = () => {
    if (navigated.current || !cardIdRef.current) return;
    navigated.current = true;
    useCardStore.getState().markJustAdded(cardIdRef.current);
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'CardList', params: { walletId: walletIdRef.current } },
        ],
      }),
    );
  };

  useEffect(() => {
    // Phase 1: card materializes
    cardOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    cardProgress.value = withDelay(
      80,
      withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
    textOpacity.value = withDelay(200, withTiming(1, { duration: 280 }));

    // Progress bar fills across the full duration
    const barDuration = TOTAL_DURATION - 500;
    barWidth.value = withDelay(
      500,
      withTiming(1, { duration: barDuration, easing: Easing.out(Easing.quad) }),
    );

    // Phase 2: cycle through processing steps
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 500;
    for (let i = 1; i <= steps.length; i++) {
      elapsed += stepDurations[i - 1];
      const fireAt = elapsed - 180;
      stepTimers.push(
        setTimeout(() => {
          stepY.value = withTiming(-20, { duration: 180, easing: Easing.in(Easing.quad) });
          stepOpacity.value = withTiming(0, { duration: 180 }, () => {
            runOnJS(setStepIndex)(i);
          });
        }, fireAt),
      );
    }

    // Phase 3: safety-net only — navigation fires via lift animation callback
    const navTimer = setTimeout(() => {
      navigateToCardList();
    }, TOTAL_DURATION + 3000);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(navTimer);
    };
  }, []);

  useEffect(() => {
    if (done) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
      [180, 220, 270, 330, 410, 520].forEach((t) =>
        setTimeout(() => Haptics.selectionAsync(), t),
      );
      checkOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      checkScale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      barOpacity.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
      setTimeout(() => navigateToCardList(), 500);
    } else {
      stepY.value = 20;
      stepOpacity.value = withTiming(1, { duration: 200 });
      stepY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    }
  }, [stepIndex]);

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

  const stepStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
    transform: [{ translateY: stepY.value }],
  }));

  const barAnimStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
  }));

  const barTrackStyle = useAnimatedStyle(() => ({
    opacity: barOpacity.value,
    height: barOpacity.value * 4,
    marginBottom: barOpacity.value * spacing.lg,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));


  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.cardWrap, cardAnimStyle]}>
          {card && <CardFront card={card} currency={currencyCode} loading={!done} />}
        </Animated.View>

        <Animated.View style={[styles.textWrap, textAnimStyle]}>
          <Animated.View style={[styles.barTrack, barTrackStyle]}>
            <Animated.View style={[styles.barFill, barAnimStyle]} />
          </Animated.View>

          <View style={styles.statusRow}>
            {!done && (
              <Animated.View style={stepStyle}>
                <Text style={styles.creating}>{steps[stepIndex]}</Text>
              </Animated.View>
            )}
            <Animated.View style={[styles.checkWrap, checkStyle]}>
              <View style={styles.checkCircle}>
                <Check size={17} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.ready}>Card ready</Text>
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

  textWrap: { alignItems: 'center', width: '100%' },

  barTrack: {
    width: '60%',
    borderRadius: 2,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },

  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.brand,
  },

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
