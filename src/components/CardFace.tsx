import React, { useEffect, useRef } from 'react';
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
import { SvgXml } from 'react-native-svg';
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

const VISA_LOGO = require('../../assets/Visa_Brandmark_White_RGB_2021.png');
const MC_LOGO = require('../../assets/ma_symbol_opt_73_3x.png');

const LOGO_SIZES = { sm: 18, md: 24, lg: 32 } as const;

export function VisaLogo({ size = 'md', dark = false }: { size?: 'sm' | 'md' | 'lg'; dark?: boolean }) {
  const h = LOGO_SIZES[size];
  return (
    <Image
      source={VISA_LOGO}
      style={{ height: h, width: h * 2.5, tintColor: dark ? '#1a1a5e' : '#fff' } as any}
      resizeMode="contain"
    />
  );
}

export function MastercardLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const w = LOGO_SIZES[size] * 2.5;
  const scale = 1.2;
  return (
    <View style={{ width: w, height: w * 0.7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: -4 }}>
      <Image
        source={MC_LOGO}
        style={{ height: w * scale, width: w * scale }}
        resizeMode="contain"
      />
    </View>
  );
}

// ─── Type labels ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CardType, string> = {
  physical:     'Physical',
  virtual:      'Virtual',
  'single-use': 'Single-use',
};


// ─── Card surface ─────────────────────────────────────────────────────────────

function CardSurface({ card, children, compact = false, width: overrideW }: { card: Card; children: React.ReactNode; compact?: boolean; width?: number }) {
  const isMetallic = card.finish === 'metallic';

  return (
    <View style={[
      styles.cardOuter,
      overrideW != null && { width: overrideW, height: overrideW / 1.586 },
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
//
// Looping mode (loading state):
//   Both faces show "•". Dot flips up, new dot comes in, hold, repeat.
//   When looping stops:
//     - If revealed=true  → one final flip: dot up, actual digit in, stop.
//     - If revealed=false → finish current cycle, stop on dot.

const LOOP_FLIP = 450;
const LOOP_HOLD = 850;

function FlipChar({
  masked,
  actual,
  revealed,
  delay,
  color,
  looping = false,
}: {
  masked: string;
  actual: string;
  revealed: boolean;
  delay: number;
  color?: string;
  looping?: boolean;
}) {
  const progress = useSharedValue(0);
  const [backFace, setBackFace] = React.useState(looping ? masked : actual);
  const loopActiveRef = useRef(false);
  const loopingPropRef = useRef(looping);
  const revealedPropRef = useRef(revealed);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  loopingPropRef.current = looping;
  revealedPropRef.current = revealed;

  const runCycle = React.useCallback(() => {
    // Flip: front (dot) rolls up, back face rolls in
    progress.value = withTiming(1, {
      duration: LOOP_FLIP,
      easing: Easing.out(Easing.cubic),
    });

    timerRef.current = setTimeout(() => {
      // Flip complete. Should we keep looping?
      if (!loopingPropRef.current) {
        if (revealedPropRef.current) {
          // Reveal: reset, put actual on back, do one last flip
          progress.value = 0;
          setBackFace(actual);
          timerRef.current = setTimeout(() => {
            progress.value = withTiming(1, {
              duration: LOOP_FLIP,
              easing: Easing.out(Easing.cubic),
            });
            loopActiveRef.current = false;
          }, 50);
        } else {
          // Just stop on dot
          loopActiveRef.current = false;
        }
        return;
      }

      // Continue looping: snap reset (both faces are dots), schedule next
      progress.value = 0;
      timerRef.current = setTimeout(runCycle, LOOP_HOLD);
    }, LOOP_FLIP);
  }, [actual, masked]);

  // Start the loop on mount
  useEffect(() => {
    if (looping) {
      loopActiveRef.current = true;
      setBackFace(masked);
      timerRef.current = setTimeout(runCycle, delay);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // When looping stops: cancel pending timers, do the reveal or settle
  useEffect(() => {
    if (!looping && loopActiveRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      loopActiveRef.current = false;
      if (revealed) {
        progress.value = 0;
        setBackFace(actual);
        timerRef.current = setTimeout(() => {
          progress.value = withTiming(1, {
            duration: LOOP_FLIP,
            easing: Easing.out(Easing.cubic),
          });
        }, delay + 50);
      } else {
        progress.value = 0;
      }
      return;
    }

    // Non-looping reveal (normal card list behavior)
    if (!loopActiveRef.current && !looping) {
      setBackFace(actual);
      progress.value = withDelay(
        delay,
        withTiming(revealed ? 1 : 0, { duration: 320, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [revealed, looping]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -CHAR_H]) }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [CHAR_H, 0]) }],
  }));

  return (
    <View style={styles.charCell}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.charInner, backStyle]}>
        <Text style={[styles.charText, color ? { color } : undefined]}>{backFace}</Text>
      </Animated.View>
      <Animated.View style={[styles.charInner, frontStyle]}>
        <Text style={[styles.charText, color ? { color } : undefined]}>{masked}</Text>
      </Animated.View>
    </View>
  );
}

// ─── 16-digit card number ─────────────────────────────────────────────────────

function FlipCardNumber({ fullNumber, revealed, color, looping = false, maskFirst12 = false }: { fullNumber: string; revealed: boolean; color?: string; looping?: boolean; maskFirst12?: boolean }) {
  const digits = fullNumber.replace(/\D/g, '').padEnd(16, '0');
  return (
    <View style={styles.flipRow}>
      {Array.from({ length: 16 }, (_, i) => {
        const isLast4 = i >= 12;
        const charRevealed = maskFirst12
          ? isLast4 && revealed
          : isLast4 || revealed;
        return (
          <React.Fragment key={i}>
            {i > 0 && i % 4 === 0 && <View style={styles.groupGap} />}
            <FlipChar
              masked="•"
              actual={!isLast4 && maskFirst12 ? '•' : digits[i] ?? '0'}
              revealed={charRevealed}
              delay={i * 38}
              color={color}
              looping={looping}
            />
          </React.Fragment>
        );
      })}
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

// ─── Expiry digits ───────────────────────────────────────────────────────────

function FlipExpiry({ expiry, revealed, color, looping = false, baseDelay = 0 }: { expiry: string; revealed: boolean; color?: string; looping?: boolean; baseDelay?: number }) {
  return (
    <View style={styles.flipRow}>
      {expiry.split('').map((ch, i) =>
        ch === '/' ? (
          <View key={i} style={styles.charCell}>
            <View style={styles.charInner}>
              <Text style={[styles.charText, color ? { color } : undefined]}>/</Text>
            </View>
          </View>
        ) : (
          <FlipChar key={i} masked="•" actual={ch} revealed={revealed} delay={baseDelay + i * 60} color={color} looping={looping} />
        ),
      )}
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
  loading = false,
  width: overrideW,
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
  loading?: boolean;
  width?: number;
}) {
  const isFrozen = card.frozen;
  const isExpired = card.expired === true;
  const interactive = !!onCopyNumber;
  // Metallic gradient peaks at near-white, so always use dark text on metal cards
  const light = card.finish === 'metallic' ? false : isLightColor(card.color);
  const inverted = card.badgeTheme === 'inverted';
  const tc = cardTextColors(light);
  const startedLoading = useRef(loading);
  const useFlipLoading = startedLoading.current;

  return (
    <CardSurface card={card} compact={compact} width={overrideW}>
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

      {/* ── Chip + contactless ── */}
      <View style={styles.chipRow}>
        {card.type === 'physical' ? (
          <>
            <SvgXml
            xml={`<svg width="116" height="86" viewBox="0 0 116 86" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="114" height="84" rx="15" fill="url(#g1)" stroke="#734100" stroke-width="2"/><g clip-path="url(#clip0)"><path d="M31.76-.5c3.85 0 7.08 2.92 7.46 6.75L41.45 28.5H-.5V-.5h32.26z" stroke="#734100" stroke-width="2"/><path d="M42 28.5c1.93 0 3.5 1.57 3.5 3.5v22c0 1.93-1.57 3.5-3.5 3.5H-.5v-29H42z" stroke="#734100" stroke-width="2"/><path d="M74 28.5h42.5v29H74a3.5 3.5 0 01-3.5-3.5V32l.005-.18A3.5 3.5 0 0174 28.5z" stroke="#734100" stroke-width="2"/><path d="M117 29V-1H84.45c-4.2 0-7.68 3.24-7.98 7.43L76 13" stroke="#734100" stroke-width="2"/><path d="M116.5 57.5v29H84.24c-3.85 0-7.08-2.92-7.46-6.75L74.55 57.5h41.95z" stroke="#734100" stroke-width="2"/><path d="M41.45 57.5l-2.23 22.25c-.38 3.83-3.61 6.75-7.46 6.75H-.5v-29h41.95z" stroke="#734100" stroke-width="2"/><circle cx="58" cy="-10" r="15.5" stroke="#734100" stroke-width="2"/><circle cx="58" cy="96" r="15.5" stroke="#734100" stroke-width="2"/></g><defs><linearGradient id="g1" x1="0" y1="0" x2="116" y2="86" gradientUnits="userSpaceOnUse"><stop stop-color="#F7C159"/><stop offset="1" stop-color="#FF8A38"/></linearGradient><clipPath id="clip0"><rect width="116" height="86" rx="16" fill="white"/></clipPath></defs></svg>`}
            width={38}
            height={28}
          />
          <View style={{ opacity: card.contactless !== false ? 1 : 0.25 }}>
            <SvgXml
              xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 56"><path fill="none" stroke="${tc.primary}" stroke-width="6" stroke-linecap="round" d="m35,3a50,50 0 0,1 0,50M24,8.5a39,39 0 0,1 0,39M13.5,13.55a28.2,28.5 0 0,1 0,28.5M3,19a18,17 0 0,1 0,18"/></svg>`}
              width={16}
              height={20}
            />
          </View>
          </>
        ) : (
          <View style={{ height: 28 }} />
        )}
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
      ) : useFlipLoading ? (
        <View style={styles.numRect}>
          <FlipCardNumber fullNumber={card.fullNumber} revealed={!loading} color={tc.primary} looping={loading} maskFirst12 />
        </View>
      ) : (
        <Text style={[styles.cardNumber, { color: tc.primary }]}>•••• •••• •••• {card.last4}</Text>
      )}

      {/* ── Bottom row: EXPIRES | CVV | spacer | network ── */}
      <View style={styles.bottomRow}>

        <View>
          <Text style={[styles.fieldLabel, { color: tc.muted }]}>EXPIRES</Text>
          {useFlipLoading ? (
            <FlipExpiry expiry={card.expiry} revealed={!loading} color={tc.primary} looping={loading} baseDelay={12 * 38} />
          ) : (
            <Text style={[styles.fieldValue, { color: tc.primary }]}>{card.expiry}</Text>
          )}
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

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginLeft: 10,
  },
  // chip styles removed — now rendered as inline SVG with 6 rounded pads

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
    marginTop: 24,
  },

  // ── Card number interactive area (no box — just layout + copy target) ──
  numRect: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 24,
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
