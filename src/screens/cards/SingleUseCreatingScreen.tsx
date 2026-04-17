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
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { useCardStore } from '../../stores/useCardStore';
import { CardFront } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SingleUseCreatingScreen({ route }: RootStackProps<'SingleUseCreating'>) {
  const navigation = useNavigation<Nav>();
  const { walletId } = route.params;
  const { addCard, cards } = useCardStore();
  const cardIdRef = useRef<string | null>(null);

  // Animation shared values
  const cardProgress = useSharedValue(1);
  const cardOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const creatingOpacity = useSharedValue(1);

  const navigateToCard = () => {
    if (!cardIdRef.current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    useCardStore.getState().markJustAdded(cardIdRef.current);
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'CardList', params: { walletId } },
        ],
      }),
    );
  };

  useEffect(() => {
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
      walletId,
      name: 'Single-use card',
      color: '#f97316',
      branded: false,
      finish: 'plastic',
      last4,
      network,
      cardholderName: 'Carlos Mendez',
      expiry: `${month}/${year}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      fullNumber,
      frozen: false,
      badgeTheme: 'default',
      type: 'single-use',
    });

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
      navigateToCard();
    }, 1700);

    return () => clearTimeout(timer);
  }, []);

  const card = cardIdRef.current ? cards.find((c) => c.id === cardIdRef.current) : null;

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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.cardWrap, cardAnimStyle]}>
          {card && <CardFront card={card} currency="USD" />}
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
