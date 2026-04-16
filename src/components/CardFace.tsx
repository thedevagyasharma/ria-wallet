import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Copy, Check, Clock, Snowflake } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../theme';
import CardOverlay from './CardOverlay';
import type { Card, CardType } from '../stores/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH - spacing.xl * 2;
export const CARD_HEIGHT = CARD_WIDTH / 1.586;
// Vertical peek between stacked cards — sized to reveal the top row (name + badges).
export const STACK_V_OFFSET = 56;

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

/** True when the card background is light enough to need dark text. */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}


function cardTextColors(light: boolean) {
  return {
    primary:   light ? 'rgba(0,0,0,0.85)'  : 'rgba(255,255,255,0.92)',
    secondary: light ? 'rgba(0,0,0,0.70)'  : 'rgba(255,255,255,0.75)',
    muted:     light ? 'rgba(0,0,0,0.45)'  : 'rgba(255,255,255,0.38)',
    icon:      light ? 'rgba(0,0,0,0.28)'  : 'rgba(255,255,255,0.28)',
  };
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

function CardSurface({ card, children, compact = false }: { card: Card; children: React.ReactNode; compact?: boolean }) {
  const isMetallic = card.finish === 'metallic';

  return (
    <View style={[
      styles.cardOuter,
      {
        borderColor: compact
          ? 'transparent'
          : isMetallic ? 'rgba(200,200,200,0.25)' : hexToRgba(card.color, 0.06),
      },
    ]}>
      <View style={[styles.card, !isMetallic && { backgroundColor: card.color }]}>

        {/* Metallic gradient background — replaces flat colour */}
        {isMetallic && (
          <LinearGradient
            colors={[
              '#181818',
              '#404040',
              '#707070',
              '#404040',
              '#181818',
            ]}
            locations={[0, 0.15, 0.5, 0.85, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

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
  color,
}: {
  masked: string;
  actual: string;
  revealed: boolean;
  delay: number;
  color?: string;
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
        <Text style={[styles.charText, color ? { color } : undefined]}>{actual}</Text>
      </Animated.View>
      <Animated.View style={[styles.charInner, frontStyle]}>
        <Text style={[styles.charText, color ? { color } : undefined]}>{masked}</Text>
      </Animated.View>
    </View>
  );
}

// ─── 16-digit card number ─────────────────────────────────────────────────────

function FlipCardNumber({ fullNumber, revealed, color }: { fullNumber: string; revealed: boolean; color?: string }) {
  const digits = fullNumber.replace(/\D/g, '').padEnd(16, '0');
  return (
    <View style={styles.flipRow}>
      {Array.from({ length: 16 }, (_, i) => (
        <React.Fragment key={i}>
          {i > 0 && i % 4 === 0 && <View style={styles.groupGap} />}
          <FlipChar masked="•" actual={digits[i] ?? '0'} revealed={i >= 12 || revealed} delay={i * 38} color={color} />
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── CVV digits ───────────────────────────────────────────────────────────────

function FlipCvv({ cvv, revealed, color }: { cvv: string; revealed: boolean; color?: string }) {
  return (
    <View style={styles.flipRow}>
      {Array.from(cvv).map((digit, i) => (
        <FlipChar key={i} masked="•" actual={digit} revealed={revealed} delay={i * 70} color={color} />
      ))}
    </View>
  );
}

// ─── Animated copy → check flip icon ─────────────────────────────────────────
// scaleX collapses Copy to 0 at the midpoint, then expands Check from 0.

function AnimatedCopyIcon({ isCopied, color, size }: { isCopied: boolean; color?: string; size: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(isCopied ? 1 : 0, {
      duration: 220,
      easing: isCopied ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [isCopied]);

  const copyStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value < 0.5 ? 1 - progress.value * 2 : 0 }],
    opacity: progress.value < 0.5 ? 1 : 0,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value >= 0.5 ? (progress.value - 0.5) * 2 : 0 }],
    opacity: progress.value >= 0.5 ? 1 : 0,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, copyStyle]}>
        <Copy size={size} color={color} strokeWidth={1.8} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, checkStyle]}>
        <Check size={size} color={color} strokeWidth={2.5} />
      </Animated.View>
    </View>
  );
}

// ─── Small floating tooltip above the copy icon ───────────────────────────────

function MiniTooltip({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  const tx = useSharedValue(-4);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 180 });
    tx.value = withTiming(visible ? 0 : -4, { duration: 180 });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <Animated.View style={[styles.miniTooltip, animStyle]} pointerEvents="none">
      <Text style={styles.miniTooltipText}>Copied</Text>
    </Animated.View>
  );
}

// ─── Ria branded card overlay ────────────────────────────────────────────────
// ria-card-overlay.png is 294×196 (aspect ≈ 1.5:1).
// The card content area (after 18px padding + 2px inner border each side) is
// ~1.586:1, so the image is proportionally taller — fitting to the content
// height leaves a small gap on the right, which is the desired left-aligned look.

const CARD_PADDING = 18;
const OVERLAY_H = CARD_HEIGHT - 4 - CARD_PADDING * 2;  // content-area height
const OVERLAY_W = OVERLAY_H * (294 / 196);              // preserve source aspect ratio

function RiaLogoWatermark() {
  return (
    <Image
      source={require('../../assets/ria-card-overlay.png')}
      style={watermarkStyles.overlay}
      resizeMode="stretch"
      pointerEvents="none"
    />
  );
}

const watermarkStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: CARD_PADDING,
    left: CARD_PADDING,
    width: OVERLAY_W,
    height: OVERLAY_H,
    mixBlendMode: 'soft-light',
  } as any,
});

// ─── Front face ──────────────────────────────────────────────────────────────

export function CardFront({
  card,
  currency,
  revealedNumber = false,
  revealedCvv = false,
  onCopyNumber,
  onCopyCvv,
  copiedField,
  compact = false,
}: {
  card: Card;
  currency?: string;
  revealedNumber?: boolean;
  revealedCvv?: boolean;
  onCopyNumber?: () => void;
  onCopyCvv?: () => void;
  copiedField?: string | null;
  /** Stack-preview mode: hides EXPIRES (CVV is already gated by interactive). */
  compact?: boolean;
}) {
  const isFrozen = card.frozen;
  const isExpired = card.expired === true;
  const interactive = !!onCopyNumber;
  // Metallic gradient peaks at near-white, so always use dark text on metal cards
  const light = card.finish === 'metallic' ? false : isLightColor(card.color);
  const inverted = card.badgeTheme === 'inverted';
  const tc = cardTextColors(light);

  return (
    <CardSurface card={card} compact={compact}>
      {isFrozen && !isExpired && <View style={styles.frozenOverlay} />}
      {card.branded && <RiaLogoWatermark />}

      {/* ── Top: name + type badge + state badge ── */}
      <View style={styles.topRow}>
        <Text style={[styles.cardName, { color: tc.secondary }]} numberOfLines={1}>{card.name}</Text>
        <View style={styles.topBadges}>
          <View style={[styles.typeBadge, { borderColor: light ? 'rgba(0,0,0,0.40)' : 'rgba(255,255,255,0.38)' }]}>
            <Text style={[styles.typeText, { color: light ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.65)' }]}>
              {TYPE_LABELS[card.type]}
            </Text>
          </View>
          {isExpired ? (
            <View style={styles.expiredBadge}>
              <Clock size={9} color="#fecaca" strokeWidth={2.5} />
              <Text style={styles.expiredText}>Expired</Text>
            </View>
          ) : isFrozen ? (
            <View style={[styles.frozenBadge, inverted && styles.frozenBadgeInverted]}>
              <Snowflake size={9} color={inverted ? '#1e3a8a' : '#bfdbfe'} strokeWidth={2.5} />
              <Text style={[styles.frozenText, inverted && styles.frozenTextInverted]}>Frozen</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Chip ── */}
      <View style={styles.chip}>
        <View style={styles.chipInner} />
      </View>

      {/* ── Card number ── */}
      {interactive ? (
        <Pressable
          onPress={revealedNumber ? onCopyNumber : undefined}
          style={styles.numRect}
        >
          <FlipCardNumber fullNumber={card.fullNumber} revealed={revealedNumber} color={tc.primary} />
          {revealedNumber && (
            <View style={styles.copyWithTooltip}>
              <AnimatedCopyIcon isCopied={copiedField === 'number'} color={tc.icon} size={17} />
              <MiniTooltip visible={copiedField === 'number'} />
            </View>
          )}
        </Pressable>
      ) : (
        <Text style={[styles.cardNumber, { color: tc.primary }]}>•••• •••• •••• {card.last4}</Text>
      )}

      {/* ── Bottom row: EXPIRES | CVV | spacer | network ── */}
      <View style={styles.bottomRow}>

        <View>
          <Text style={[styles.fieldLabel, { color: tc.muted }]}>EXPIRES</Text>
          <Text style={[styles.fieldValue, { color: tc.primary }]}>{card.expiry}</Text>
        </View>

        {interactive && (
          <View style={styles.cvvBlock}>
            <Text style={[styles.fieldLabel, { color: tc.muted }]}>CVV</Text>
            <Pressable
              onPress={revealedCvv ? onCopyCvv : undefined}
              style={styles.cvvRow}
            >
              <FlipCvv cvv={card.cvv} revealed={revealedCvv} color={tc.primary} />
              {revealedCvv && (
                <View style={[styles.copyWithTooltip, { marginLeft: 6 }]}>
                  <AnimatedCopyIcon isCopied={copiedField === 'cvv'} color={tc.icon} size={17} />
                  <MiniTooltip visible={copiedField === 'cvv'} />
                </View>
              )}
            </Pressable>
          </View>
        )}

        <View style={{ flex: 1 }} />
        {card.network === 'Visa' ? <VisaLogo dark={light} /> : <MastercardLogo />}
      </View>
    </CardSurface>
  );
}

// ─── "+N more cards" placeholder ─────────────────────────────────────────────
// Sits at the back of a stack preview. Only its top row peeks out (STACK_V_OFFSET),
// so we render a stripped-down surface — no overlay, chip, number, or type badge.

export function MoreCardsPlaceholder({ count }: { count: number }) {
  return (
    <View style={[styles.cardOuter, { borderColor: 'transparent' }]}>
      <View style={[styles.card, { backgroundColor: colors.surfaceHigh }]}>
        <View style={styles.topRow}>
          <Text style={[styles.cardName, { color: colors.textSecondary }]} numberOfLines={1}>
            +{count} more {count === 1 ? 'card' : 'cards'}
          </Text>
        </View>
      </View>
    </View>
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

  // ── Top badges row (type + state) ──
  topBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  // Type badge — outline only, always white so it reads on any card hue
  typeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 7,
    height: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  typeText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: typography.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // ── Frozen ──
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(147,197,253,0.07)',
  },

  // State badges — layout only; colors applied inline based on card lightness
  frozenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    height: 20,
    backgroundColor: 'rgba(30,64,175,0.88)',
  },
  frozenText: { fontSize: 10, color: '#bfdbfe', fontWeight: typography.semibold },
  frozenBadgeInverted: { backgroundColor: 'rgba(255,255,255,0.88)' },
  frozenTextInverted: { color: '#1e3a8a' },
  // Expired always uses a dark opaque red — light/dark split skipped because
  // semi-transparent red disappears on warm card hues (orange, amber, etc.)
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    height: 20,
    backgroundColor: 'rgba(153,27,27,0.88)',
  },
  expiredText: { fontSize: 10, color: '#fecaca', fontWeight: typography.semibold },

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

  // ── Copy icon wrapper — anchors the floating tooltip ──
  // ── Icon + tooltip inline row ──
  copyWithTooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
  },

  // ── Icon centering helper (used inside absoluteFill) ──
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Mini tooltip — sits inline to the right of the copy icon ──
  miniTooltip: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  miniTooltipText: {
    fontSize: 10,
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
