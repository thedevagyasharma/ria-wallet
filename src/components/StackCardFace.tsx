import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Snowflake, Clock } from 'lucide-react-native';
import { typography, radius, spacing } from '../theme';
import CardOverlay from './CardOverlay';
import type { Card } from '../stores/types';

// Card face dimensions — derived from the common H_PAD = spacing.xl = 24 used by
// both WalletsScreen and CardStackPreview. The outer border is 1px each side so
// the SVG surface is 2px narrower/shorter than the outer shell.
export const STACK_CARD_H   = 100;
export const STACK_V_OFFSET = 56;

const { width: SCREEN_W } = Dimensions.get('window');
const OUTER_W = SCREEN_W - spacing.xl * 2;
export const SVG_W = OUTER_W - 2;
export const SVG_H = STACK_CARD_H - 2;
export const SVG_R = radius.lg - 1;

type Props = {
  card: Card;
  /** Show the masked PAN on the front card (idx === 0). */
  showLast4: boolean;
};

export default function StackCardFace({ card, showLast4 }: Props) {
  const typeLabel =
    card.type === 'single-use'
      ? 'Single-use'
      : card.type.charAt(0).toUpperCase() + card.type.slice(1);
  const inverted  = card.badgeTheme === 'inverted';
  const isExpired = card.expired === true;
  const isFrozen  = card.frozen;

  return (
    <View style={[styles.inner, { backgroundColor: card.color }]}>
      <CardOverlay id={card.id} width={SVG_W} height={SVG_H} borderRadius={SVG_R} strokeWidth={1} />

      <View style={styles.top}>
        <Text
          style={[styles.name, { color: inverted ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.80)' }]}
          numberOfLines={1}
        >
          {card.name}
        </Text>

        <View style={styles.badges}>
          {/* Type — outline only */}
          <View style={[styles.typeBadge, {
            borderColor: inverted ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.40)',
          }]}>
            <Text style={[styles.typeText, {
              color: inverted ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.72)',
            }]}>
              {typeLabel}
            </Text>
          </View>

          {/* State — near-opaque fill for guaranteed contrast */}
          {isExpired ? (
            <View style={styles.expiredBadge}>
              <Clock size={8} color="#fecaca" strokeWidth={2.5} />
              <Text style={styles.expiredText}>Expired</Text>
            </View>
          ) : isFrozen ? (
            <View style={[styles.frozenBadge, inverted && styles.frozenBadgeInverted]}>
              <Snowflake size={8} color={inverted ? '#1e3a8a' : '#bfdbfe'} strokeWidth={2.5} />
              <Text style={[styles.frozenText, inverted && styles.frozenTextInverted]}>Frozen</Text>
            </View>
          ) : null}
        </View>
      </View>

      {showLast4 && (
        <Text style={[styles.last4, { color: inverted ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.40)' }]}>
          •••• •••• •••• {card.last4}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    borderRadius: SVG_R,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 7,
    height: 18,
    justifyContent: 'center',
    borderWidth: 1,
  },
  typeText: {
    fontSize: 8,
    fontWeight: typography.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  frozenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    height: 18,
    backgroundColor: 'rgba(30,64,175,0.88)',
  },
  frozenBadgeInverted: { backgroundColor: 'rgba(255,255,255,0.88)' },
  frozenText: { fontSize: 8, color: '#bfdbfe', fontWeight: typography.semibold },
  frozenTextInverted: { color: '#1e3a8a' },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    height: 18,
    backgroundColor: 'rgba(153,27,27,0.88)',
  },
  expiredText: { fontSize: 8, color: '#fecaca', fontWeight: typography.semibold },
  last4: {
    fontSize: typography.sm,
    letterSpacing: 2,
  },
});
