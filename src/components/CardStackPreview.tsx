import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors, typography, radius } from '../theme';
import { alpha } from '../utils/color';
import { CardFront, CARD_HEIGHT, STACK_V_OFFSET } from './CardFace';
import type { Card } from '../stores/types';

export { CARD_HEIGHT, STACK_V_OFFSET };

const SPREAD_V_OFFSET = 90;
const SPREAD_DRAG_DIST = 160;

function CardSlot({
  card,
  index,
  totalCards,
  spreadProgress,
  liftProgress,
  liftedIndex,
}: {
  card: Card;
  index: number;
  totalCards: number;
  spreadProgress: SharedValue<number>;
  liftProgress: SharedValue<number>;
  liftedIndex: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    const sp = spreadProgress.value;
    const n = totalCards;

    const stagger = n > 1 ? 0.7 / (n - 1) : 0;
    const delay = index * stagger;
    const perSp = Math.min(1, Math.max(0, (sp - delay) / Math.max(0.01, 1 - delay)));

    const vOff = STACK_V_OFFSET + perSp * (SPREAD_V_OFFSET - STACK_V_OFFSET);
    const baseY = (n - 1 - index) * vOff;

    const shrink = 0.01 * Math.min(index, 6) * (1 - sp);
    const baseScale = 1 - shrink;

    const lift = liftedIndex.value === index ? liftProgress.value * 8 : 0;

    return {
      transform: [
        { translateY: baseY - lift },
        { scale: baseScale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.stackOuter,
        index === 0 && styles.frontShadow,
        { zIndex: totalCards - index },
        animStyle,
      ]}
    >
      <CardFront card={card} compact />
    </Animated.View>
  );
}

type Props = {
  cards: Card[];
  accent: string;
  onPressCard: (index: number) => void;
  showHeader?: boolean;
};

export default function CardStackPreview({ cards, accent, onPressCard, showHeader = true }: Props) {
  const spreadProgress = useSharedValue(0);
  const spreadStart = useSharedValue(0);
  const startTouchY = useSharedValue(0);
  const startTapLocalY = useSharedValue(0);
  const hasMoved = useSharedValue(false);
  const liftProgress = useSharedValue(0);
  const liftedIndex = useSharedValue(-1);
  const count = cards.length;

  const containerAnimStyle = useAnimatedStyle(() => {
    const sp = spreadProgress.value;
    const vOff = STACK_V_OFFSET + sp * (SPREAD_V_OFFSET - STACK_V_OFFSET);
    const h = count <= 1 ? CARD_HEIGHT : CARD_HEIGHT + vOff * (count - 1);
    return { height: h };
  });

  const handleTapAtY = useCallback((tapY: number) => {
    if (count === 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPressCard(-1);
      return;
    }
    const sp = spreadProgress.value;
    const n = count;
    const vOff = STACK_V_OFFSET + sp * (SPREAD_V_OFFSET - STACK_V_OFFSET);
    let tappedIndex = n - 1;
    for (let i = 0; i < n; i++) {
      if (tapY >= (n - 1 - i) * vOff) { tappedIndex = i; break; }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    liftedIndex.value = tappedIndex;
    liftProgress.value = 0;
    liftProgress.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      onPressCard(tappedIndex);
      liftProgress.value = 0;
      liftedIndex.value = -1;
    }, 140);
  }, [count, onPressCard]);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e) => {
        startTouchY.value = e.allTouches[0].absoluteY;
        startTapLocalY.value = e.allTouches[0].y;
        hasMoved.value = false;
      })
      .onTouchesMove((e, state) => {
        const dy = e.allTouches[0].absoluteY - startTouchY.value;
        if (Math.abs(dy) > 8) hasMoved.value = true;
        if (dy > 14 || (spreadProgress.value > 0.01 && dy < -14)) state.activate();
        else if (spreadProgress.value < 0.01 && dy < -20) state.fail();
      })
      .onTouchesUp((_, state) => {
        if (!hasMoved.value) {
          runOnJS(handleTapAtY)(startTapLocalY.value);
        }
        state.fail();
      })
      .onStart(() => { spreadStart.value = spreadProgress.value; })
      .onUpdate((e) => {
        const newSp = spreadStart.value + e.translationY / SPREAD_DRAG_DIST;
        spreadProgress.value = Math.max(0, Math.min(1, newSp));
      })
      .onEnd((e) => {
        const vel = e.velocityY;
        if (vel > 800) {
          spreadProgress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
        } else if (vel < -800) {
          spreadProgress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        }
      }),
    [handleTapAtY],
  );

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.head}>
          <Text style={styles.label}>Cards</Text>
          <Text style={[styles.viewAll, { color: accent }]}>
            {count > 0 ? 'View all  →' : 'Add card  →'}
          </Text>
        </View>
      )}

      {count === 0 ? (
        <Pressable onPress={() => onPressCard(-1)}>
          <View style={[
            styles.empty,
            { borderColor: alpha(accent, 0.25), backgroundColor: alpha(accent, 0.04) },
          ]}>
            <Text style={[styles.emptyText, { color: accent }]}>+ Add your first card</Text>
          </View>
        </Pressable>
      ) : (
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.stackContainer, containerAnimStyle]}>
            {cards.map((card, idx) => (
              <CardSlot
                key={card.id}
                card={card}
                index={idx}
                totalCards={count}
                spreadProgress={spreadProgress}
                liftProgress={liftProgress}
                liftedIndex={liftedIndex}
              />
            ))}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  viewAll: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  empty: {
    height: CARD_HEIGHT,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  stackContainer: {
    position: 'relative',
    width: '100%',
  },
  stackOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius.xl,
  },
  frontShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
