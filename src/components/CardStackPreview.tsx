import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, radius } from '../theme';
import { alpha } from '../utils/color';
import { CardFront, MoreCardsPlaceholder, CARD_HEIGHT, STACK_V_OFFSET } from './CardFace';
import type { Card } from '../stores/types';

export { CARD_HEIGHT, STACK_V_OFFSET };

const MAX_REAL_CARDS = 3;

// Press feedback — mirrored by AnimatedCardStack in WalletsScreen so both entry points feel identical.
const PRESS_LIFT      = 6;
const PRESS_SCALE     = 0.025;
// Depth per slot (front → back). The "+N more" placeholder uses 0 so it stays
// static while real cards lift on press — reads as a backplate, not a card.
const DEPTH_MULT      = [1, 0.55, 0.25];
const PRESS_IN_MS     = 140;
const PRESS_OUT_MS    = 180;

// ─── Per-slot item ────────────────────────────────────────────────────────────

type ItemProps = {
  idx: number;
  totalShown: number;
  pressProgress: SharedValue<number>;
  children: React.ReactNode;
  depth?: number;
};

function StackSlot({ idx, totalShown, pressProgress, children, depth }: ItemProps) {
  const topOffset = (totalShown - 1 - idx) * STACK_V_OFFSET;
  const baseScale = 1 - idx * 0.02;
  const slotDepth = depth ?? DEPTH_MULT[idx] ?? 0;

  const animStyle = useAnimatedStyle(() => {
    const p = pressProgress.value * slotDepth;
    return {
      transform: [
        { translateY: -p * PRESS_LIFT },
        { scale: baseScale * (1 + p * PRESS_SCALE) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.stackOuter,
        idx === 0 && styles.frontShadow,
        {
          top: topOffset,
          zIndex: totalShown - idx,
        },
        animStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

type Props = { cards: Card[]; accent: string; onPress: () => void; showHeader?: boolean };

export default function CardStackPreview({ cards, accent, onPress, showHeader = true }: Props) {
  const pressProgress = useSharedValue(0);

  const shown = cards.slice(0, MAX_REAL_CARDS);
  const count = cards.length;
  const overflow = Math.max(0, count - MAX_REAL_CARDS);
  const totalSlots = shown.length + (overflow > 0 ? 1 : 0);
  const containerH = CARD_HEIGHT + STACK_V_OFFSET * Math.max(0, totalSlots - 1);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pressProgress.value = withTiming(1, { duration: PRESS_IN_MS, easing: Easing.out(Easing.cubic) });
  };

  const handlePressOut = () => {
    pressProgress.value = withTiming(0, { duration: PRESS_OUT_MS, easing: Easing.out(Easing.cubic) });
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPress={onPress}
      onPressOut={handlePressOut}
      pressRetentionOffset={{ top: 40, left: 40, right: 40, bottom: 40 }}
      style={styles.container}
    >
      {showHeader && (
        <View style={styles.head}>
          <Text style={styles.label}>Cards</Text>
          <Text style={[styles.viewAll, { color: accent }]}>
            {count > 0 ? 'View all  →' : 'Add card  →'}
          </Text>
        </View>
      )}

      {count === 0 ? (
        <View style={[
          styles.empty,
          { borderColor: alpha(accent, 0.25), backgroundColor: alpha(accent, 0.04) },
        ]}>
          <Text style={[styles.emptyText, { color: accent }]}>+ Add your first card</Text>
        </View>
      ) : (
        <View style={[styles.stackContainer, { height: containerH }]}>
          {shown.map((card, idx) => (
            <StackSlot
              key={card.id}
              idx={idx}
              totalShown={totalSlots}
              pressProgress={pressProgress}
            >
              <CardFront card={card} compact />
            </StackSlot>
          ))}
          {overflow > 0 && (
            <StackSlot
              key="more-placeholder"
              idx={totalSlots - 1}
              totalShown={totalSlots}
              pressProgress={pressProgress}
              depth={0}
            >
              <MoreCardsPlaceholder count={overflow} />
            </StackSlot>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    // Kept small on purpose — a transformed view with a large blurred shadow
    // forces iOS to recompute the shadow shape every animation frame.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
