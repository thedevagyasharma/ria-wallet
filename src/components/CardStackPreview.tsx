import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, radius, spacing } from '../theme';
import { alpha } from '../utils/color';
import StackCardFace, { STACK_CARD_H, STACK_V_OFFSET } from './StackCardFace';
import type { Card } from '../stores/types';

export { STACK_CARD_H, STACK_V_OFFSET };

const MAX_STACK = 3;

// ─── Per-card item ────────────────────────────────────────────────────────────

type ItemProps = { card: Card; idx: number; totalShown: number };

function StackCardItem({ card, idx, totalShown }: ItemProps) {
  const topOffset = (totalShown - 1 - idx) * STACK_V_OFFSET;

  return (
    <View
      style={[
        styles.stackOuter,
        {
          borderColor: alpha(card.color, 0.06),
          top: topOffset,
          zIndex: totalShown - idx,
          transform: [{ scale: 1 - idx * 0.02 }],
        },
      ]}
    >
      <StackCardFace card={card} showLast4={idx === 0} />
    </View>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

type Props = { cards: Card[]; accent: string; onPress: () => void; showHeader?: boolean };

export default function CardStackPreview({ cards, accent, onPress, showHeader = true }: Props) {
  const shown = cards.slice(0, MAX_STACK);
  const count = cards.length;
  const containerH = STACK_CARD_H + STACK_V_OFFSET * (shown.length - 1);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.82 }]}
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
            <StackCardItem key={card.id} card={card} idx={idx} totalShown={shown.length} />
          ))}
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
    height: STACK_CARD_H,
    borderRadius: radius.lg,
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
    height: STACK_CARD_H,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
