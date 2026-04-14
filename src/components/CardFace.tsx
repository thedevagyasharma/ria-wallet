import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import CardOverlay from './CardOverlay';
import type { Card, CardType } from '../stores/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH - spacing.xl * 2;
export const CARD_HEIGHT = CARD_WIDTH / 1.586;

// Inner card surface dimensions (cardOuter has 2px border on each side)
const SVG_W = CARD_WIDTH - 4;
const SVG_H = CARD_HEIGHT - 4;
const SVG_R = radius.xl - 2;


function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Network logos ────────────────────────────────────────────────────────────

export function VisaLogo({ size = 'md', dark = false }: { size?: 'sm' | 'md' | 'lg'; dark?: boolean }) {
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 22 : 17;
  return (
    <Text style={[logoStyles.visa, { fontSize }, dark && logoStyles.visaDark]}>VISA</Text>
  );
}

export function MastercardLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const d = size === 'sm' ? 18 : size === 'lg' ? 32 : 24;
  const overlap = d * 0.35;
  return (
    <View style={{ width: d * 2 - overlap, height: d, position: 'relative' }}>
      <View style={[logoStyles.mcCircle, { width: d, height: d, borderRadius: d / 2, backgroundColor: '#EB001B', left: 0 }]} />
      <View style={[logoStyles.mcCircle, { width: d, height: d, borderRadius: d / 2, backgroundColor: '#F79E1B', right: 0, opacity: 0.95 }]} />
    </View>
  );
}

const logoStyles = StyleSheet.create({
  visa: {
    color: '#fff',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1.5,
  },
  visaDark: {
    color: '#1a1a5e',
  },
  mcCircle: {
    position: 'absolute',
    top: 0,
  },
});

// ─── Type labels ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CardType, string> = {
  physical:     'Physical',
  virtual:      'Virtual',
  'single-use': 'Single-use',
};

// ─── Shared card surface ──────────────────────────────────────────────────────
// Wraps the card in a 1px ring (box-shadow: 0 0 0 1px color@6%) and applies
// per-side border colors for the top highlight and bottom shadow insets.

function CardSurface({ card, style, children }: {
  card: Card;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.cardOuter, { borderColor: hexToRgba(card.color, 0.06) }]}>
      <View style={[styles.card, { backgroundColor: card.color }, style]}>
        <CardOverlay id={card.id} width={SVG_W} height={SVG_H} borderRadius={SVG_R} strokeWidth={2} />
        {children}
      </View>
    </View>
  );
}

// ─── Front face ──────────────────────────────────────────────────────────────

export function CardFront({ card, currency }: { card: Card; currency: string }) {
  const isFrozen = card.frozen;

  return (
    <CardSurface card={card}>
      {/* Frozen overlay */}
      {isFrozen && <View style={styles.frozenOverlay} />}

      {/* Top row */}
      <View style={styles.topRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardName}>{card.name}</Text>
          <View style={styles.topMeta}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{TYPE_LABELS[card.type]}</Text>
            </View>
            <Text style={styles.walletLabel}>{currency}</Text>
          </View>
        </View>
        {isFrozen && (
          <View style={styles.frozenBadge}>
            <Text style={styles.frozenIcon}>❄️</Text>
            <Text style={styles.frozenText}>Frozen</Text>
          </View>
        )}
      </View>

      {/* Chip */}
      <View style={styles.chip}>
        <View style={styles.chipInner} />
      </View>

      {/* Card number */}
      <Text style={styles.cardNumber}>
        •••• •••• •••• {card.last4}
      </Text>

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <View style={styles.expiryBlock}>
          <Text style={styles.fieldLabel}>EXPIRES</Text>
          <Text style={styles.fieldValue}>{card.expiry}</Text>
        </View>
        {card.network === 'Visa' ? <VisaLogo /> : <MastercardLogo />}
      </View>
    </CardSurface>
  );
}

// ─── Back face ───────────────────────────────────────────────────────────────

export function CardBack({ card }: { card: Card }) {
  return (
    <CardSurface card={card}>
      {/* Magnetic stripe */}
      <View style={styles.stripe} />

      <View style={styles.backContent}>
        <View>
          <Text style={styles.fieldLabel}>CARD NUMBER</Text>
          <Text style={styles.fullNumber}>{card.fullNumber}</Text>
        </View>

        <View style={styles.cvvRow}>
          <View>
            <Text style={styles.fieldLabel}>CVV</Text>
            <View style={styles.cvvBox}>
              <Text style={styles.cvvValue}>{card.cvv}</Text>
            </View>
          </View>
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to hide</Text>
          </View>
        </View>

        <Text style={styles.securityNote}>
          Never share your card details with anyone.
        </Text>
      </View>
    </CardSurface>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Outer ring: 0 0 0 2px card-color@6%
  cardOuter: {
    borderWidth: 2,
    borderRadius: radius.xl,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },

  // Inner card surface
  card: {
    flex: 1,
    borderRadius: radius.xl - 2,
    padding: spacing.xl,
    overflow: 'hidden',        // clips edgeTop/edgeBottom to the rounded corners
    backfaceVisibility: 'hidden',
  },

  // Frozen
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(147,197,253,0.07)',
  },
  frozenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(147,197,253,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  frozenIcon: { fontSize: 12 },
  frozenText: { fontSize: typography.xs, color: '#93c5fd', fontWeight: typography.semibold },

  // Top
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    fontSize: typography.md,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: typography.semibold,
    letterSpacing: 0.3,
  },
  topMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walletLabel: {
    fontSize: typography.xs,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: typography.medium,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: typography.xs,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: typography.medium,
    letterSpacing: 0.5,
  },

  // Chip
  chip: {
    width: 38,
    height: 28,
    backgroundColor: '#c8a84b',
    borderRadius: 5,
    marginTop: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInner: {
    width: 28,
    height: 18,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#a07830',
  },

  // Card number
  cardNumber: {
    fontSize: typography.lg,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.semibold,
    letterSpacing: 3,
    marginTop: spacing.lg,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 'auto',
    gap: spacing.xl,
  },
  expiryBlock: {},
  fieldLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: typography.semibold,
    letterSpacing: 1,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: typography.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.semibold,
    letterSpacing: 0.5,
  },

  // Back
  stripe: {
    position: 'absolute',
    top: CARD_HEIGHT * 0.22,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backContent: {
    flex: 1,
    marginTop: CARD_HEIGHT * 0.22 + 44 + spacing.lg,
    gap: spacing.lg,
  },
  fullNumber: {
    fontSize: typography.md,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.semibold,
    letterSpacing: 2,
    marginTop: 4,
  },
  cvvRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cvvBox: {
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  cvvValue: {
    fontSize: typography.base,
    color: '#18181b',
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  tapHint: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tapHintText: {
    fontSize: typography.xs,
    color: 'rgba(255,255,255,0.4)',
  },
  securityNote: {
    fontSize: typography.xs,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});
