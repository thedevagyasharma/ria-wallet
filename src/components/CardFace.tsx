import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Copy, Check } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../theme';
import CardOverlay from './CardOverlay';
import type { Card, CardType } from '../stores/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH - spacing.xl * 2;
export const CARD_HEIGHT = CARD_WIDTH / 1.586;

const SVG_W = CARD_WIDTH - 4;
const SVG_H = CARD_HEIGHT - 4;
const SVG_R = radius.xl - 2;

// Single character size — used for card number, CVV, and expiry digits alike
const CHAR_W = 12;
const CHAR_H = 22;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  visa: { color: '#fff', fontWeight: '900', fontStyle: 'italic', letterSpacing: 1.5 },
  visaDark: { color: '#1a1a5e' },
  mcCircle: { position: 'absolute', top: 0 },
});

// ─── Type labels ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CardType, string> = {
  physical:     'Physical',
  virtual:      'Virtual',
  'single-use': 'Single-use',
};

// ─── Card surface ─────────────────────────────────────────────────────────────

function CardSurface({ card, children }: { card: Card; children: React.ReactNode }) {
  return (
    <View style={[styles.cardOuter, { borderColor: hexToRgba(card.color, 0.06) }]}>
      <View style={[styles.card, { backgroundColor: card.color }]}>
        <CardOverlay id={card.id} width={SVG_W} height={SVG_H} borderRadius={SVG_R} strokeWidth={2} />
        {children}
      </View>
    </View>
  );
}

// ─── Slot-machine flip character ──────────────────────────────────────────────
// The masked dot rolls UP and exits; the actual digit rolls UP from below.

function FlipChar({
  masked,
  actual,
  revealed,
  delay,
}: {
  masked: string;
  actual: string;
  revealed: boolean;
  delay: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(revealed ? 1 : 0, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, [revealed]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -CHAR_H]) }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [CHAR_H, 0]) }],
  }));

  return (
    <View style={styles.charCell}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.charInner, backStyle]}>
        <Text style={styles.charText}>{actual}</Text>
      </Animated.View>
      <Animated.View style={[styles.charInner, frontStyle]}>
        <Text style={styles.charText}>{masked}</Text>
      </Animated.View>
    </View>
  );
}

// ─── 16-digit card number ─────────────────────────────────────────────────────

function FlipCardNumber({ fullNumber, revealed }: { fullNumber: string; revealed: boolean }) {
  const digits = fullNumber.replace(/\D/g, '').padEnd(16, '0');
  return (
    <View style={styles.flipRow}>
      {Array.from({ length: 16 }, (_, i) => (
        <React.Fragment key={i}>
          {i > 0 && i % 4 === 0 && <View style={styles.groupGap} />}
          <FlipChar masked="•" actual={digits[i] ?? '0'} revealed={i >= 12 || revealed} delay={i * 38} />
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── CVV digits ───────────────────────────────────────────────────────────────

function FlipCvv({ cvv, revealed }: { cvv: string; revealed: boolean }) {
  return (
    <View style={styles.flipRow}>
      {Array.from(cvv).map((digit, i) => (
        <FlipChar key={i} masked="•" actual={digit} revealed={revealed} delay={i * 70} />
      ))}
    </View>
  );
}

// ─── "Copied" tooltip ─────────────────────────────────────────────────────────
// Absolute-positioned, centered over the card face. Fades in/out.

function CopiedTooltip({ copiedField }: { copiedField?: string | null }) {
  const opacity = useSharedValue(0);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (copiedField) setLabel(copiedField === 'number' ? 'Number copied' : 'CVV copied');
    opacity.value = withTiming(copiedField ? 1 : 0, { duration: 180 });
  }, [copiedField]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.tooltipWrap, animStyle]} pointerEvents="none">
      <View style={styles.tooltipPill}>
        <Check size={10} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
        <Text style={styles.tooltipText}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Front face ──────────────────────────────────────────────────────────────

export function CardFront({
  card,
  currency,
  revealedNumber = false,
  revealedCvv = false,
  onCopyNumber,
  onCopyCvv,
  copiedField,
}: {
  card: Card;
  currency: string;
  revealedNumber?: boolean;
  revealedCvv?: boolean;
  onCopyNumber?: () => void;
  onCopyCvv?: () => void;
  copiedField?: string | null;
}) {
  const isFrozen = card.frozen;
  const interactive = !!onCopyNumber;

  return (
    <CardSurface card={card}>
      {isFrozen && <View style={styles.frozenOverlay} />}

      {/* ── Top: name + frozen badge ── */}
      <View style={styles.topRow}>
        <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
        {isFrozen && (
          <View style={styles.frozenBadge}>
            <Text style={styles.frozenIcon}>❄️</Text>
            <Text style={styles.frozenText}>Frozen</Text>
          </View>
        )}
      </View>

      {/* ── Chip ── */}
      <View style={styles.chip}>
        <View style={styles.chipInner} />
      </View>

      {/* ── Card number ── */}
      {interactive ? (
        // Subtle rect signals: this area is interactive (tap to copy when revealed)
        <Pressable
          onPress={revealedNumber ? onCopyNumber : undefined}
          style={styles.numRect}
        >
          <FlipCardNumber fullNumber={card.fullNumber} revealed={revealedNumber} />
          {revealedNumber && (
            <Copy size={17} color="rgba(255,255,255,0.28)" strokeWidth={1.8} style={{ marginLeft: 10 }} />
          )}
        </Pressable>
      ) : (
        <Text style={styles.cardNumber}>•••• •••• •••• {card.last4}</Text>
      )}

      {/* ── Bottom row: EXPIRES | CVV | spacer | network ── */}
      <View style={styles.bottomRow}>

        <View>
          <Text style={styles.fieldLabel}>EXPIRES</Text>
          {/* lineHeight: CHAR_H so it aligns with CVV flip chars */}
          <Text style={styles.fieldValue}>{card.expiry}</Text>
        </View>

        {interactive && (
          <View style={styles.cvvBlock}>
            <Text style={styles.fieldLabel}>CVV</Text>
            {/* Pressable wraps flip chars — tap copies when revealed */}
            <Pressable
              onPress={revealedCvv ? onCopyCvv : undefined}
              style={styles.cvvRow}
            >
              <FlipCvv cvv={card.cvv} revealed={revealedCvv} />
              {revealedCvv && (
                <Copy size={17} color="rgba(255,255,255,0.28)" strokeWidth={1.8} style={{ marginLeft: 6 }} />
              )}
            </Pressable>
          </View>
        )}

        <View style={{ flex: 1 }} />
        {card.network === 'Visa' ? <VisaLogo /> : <MastercardLogo />}
      </View>

      {interactive && <CopiedTooltip copiedField={copiedField} />}
    </CardSurface>
  );
}

// ─── Back face (legacy) ───────────────────────────────────────────────────────

export function CardBack({ card }: { card: Card }) {
  return (
    <CardSurface card={card}>
      <View style={styles.stripe} />
      <View style={styles.backContent}>
        <View>
          <Text style={styles.fieldLabel}>CARD NUMBER</Text>
          <Text style={styles.fullNumber}>{card.fullNumber}</Text>
        </View>
        <View>
          <Text style={styles.fieldLabel}>CVV</Text>
          <View style={styles.backCvvBox}>
            <Text style={styles.backCvvValue}>{card.cvv}</Text>
          </View>
        </View>
        <Text style={styles.securityNote}>Never share your card details with anyone.</Text>
      </View>
    </CardSurface>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardOuter: {
    borderWidth: 2,
    borderRadius: radius.xl,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  // Reduced padding (18px) vs xl (24px) to give content more breathing room
  card: {
    flex: 1,
    borderRadius: radius.xl - 2,
    padding: 18,
    overflow: 'hidden',
  },

  // ── Frozen ──
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
  frozenIcon: { fontSize: 11 },
  frozenText: { fontSize: 10, color: '#93c5fd', fontWeight: typography.semibold },

  // ── Top row ──
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: typography.sm,      // 13 — legible but not dominating
    color: 'rgba(255,255,255,0.75)',
    fontWeight: typography.semibold,
    letterSpacing: 0.3,
    flex: 1,
    marginRight: spacing.sm,
  },

  // ── Chip — proper EMV size, good gap below the name ──
  chip: {
    width: 38,
    height: 28,
    backgroundColor: '#c8a84b',
    borderRadius: 5,
    marginTop: spacing.lg,       // 16px — clear separation from name
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInner: { width: 28, height: 18, borderRadius: 3, borderWidth: 1, borderColor: '#a07830' },

  // ── Flip character cell (shared by number + CVV) ──
  charCell: {
    width: CHAR_W,
    height: CHAR_H,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charInner: { alignItems: 'center', justifyContent: 'center' },
  charText: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: typography.semibold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  flipRow: { flexDirection: 'row', alignItems: 'center' },
  groupGap: { width: 9 },

  // ── Card number — non-interactive static version ──
  cardNumber: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.semibold,
    letterSpacing: 3,
    marginTop: spacing.xxl,
  },

  // ── Card number interactive area (no box — just layout + copy target) ──
  numRect: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.xxl,      // 32px — balanced between chip and bottom row
  },

  // ── Bottom row ──
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },

  // ── EXPIRES + CVV shared label style ──
  fieldLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: typography.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // ── EXPIRES value — matches charText size so it aligns with CVV flip chars ──
  fieldValue: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.semibold,
    lineHeight: CHAR_H,          // 22 — exact match with FlipCvv cell height
    letterSpacing: 0.5,
  },

  // ── CVV block ──
  cvvBlock: { marginLeft: spacing.xxl },
  cvvRow: { flexDirection: 'row', alignItems: 'center' },

  // ── Copied tooltip ──
  tooltipWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tooltipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.semibold,
    letterSpacing: 0.3,
  },

  // ── Back face ──
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
  backCvvBox: {
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  backCvvValue: {
    fontSize: typography.base,
    color: '#18181b',
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  securityNote: {
    fontSize: typography.xs,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});
