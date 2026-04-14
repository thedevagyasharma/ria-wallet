import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { colors, typography, radius, spacing } from '../theme';
import CardOverlay from './CardOverlay';
import type { Card } from '../stores/types';

export const STACK_CARD_H   = 100;
export const STACK_V_OFFSET = 56;
const MAX_STACK = 3;

// Stack cards live in a container with paddingHorizontal: spacing.xl on each side
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OUTER_W = SCREEN_WIDTH - spacing.xl * 2; // outer card width (incl. 1px border)
const OUTER_H = STACK_CARD_H;
const SVG_W   = OUTER_W - 2;                   // inner surface (border is 1px each side)
const SVG_H   = OUTER_H - 2;
const SVG_R   = radius.lg - 1;                 // inset-adjusted border radius

function alpha(hex: string, o: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${o})`;
}

// ─── Per-card item ────────────────────────────────────────────────────────────

type ItemProps = { card: Card; idx: number; totalShown: number };

function StackCardItem({ card, idx, totalShown }: ItemProps) {
  const topOffset = (totalShown - 1 - idx) * STACK_V_OFFSET;
  const typeLabel = card.type === 'single-use' ? 'Single-use'
    : card.type.charAt(0).toUpperCase() + card.type.slice(1);

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
      <View style={[styles.stackCard, { backgroundColor: card.color }]}>
        <CardOverlay id={card.id} width={SVG_W} height={SVG_H} borderRadius={SVG_R} strokeWidth={1} />

        {/* Content */}
        <View style={styles.cardTop}>
          <Text style={styles.cardName}>{card.name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{typeLabel}</Text>
          </View>
        </View>
        {idx === 0 && (
          <Text style={styles.last4}>•••• •••• •••• {card.last4}</Text>
        )}
      </View>
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
    height: OUTER_H,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  stackCard: {
    flex: 1,
    borderRadius: radius.lg - 1,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: typography.base,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: typography.semibold,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: typography.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: typography.medium,
  },
  last4: {
    fontSize: typography.sm,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2,
  },
});
