import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Shield } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../theme';
import BottomSheet from './BottomSheet';
import FlatButton from './FlatButton';

const AUTO_HIDE_SECONDS = 15;

const RING_SIZE = 48;
const STROKE_WIDTH = 3;
const R = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Drum-flip digit ──────────────────────────────────────────────────────────
// Each cell is a vertical strip: [ • 0 1 2 3 4 5 6 7 8 9 ]
// translateY selects the visible item through the clipped box.

const BOX_H = 56;
const DIGIT_H = BOX_H;

const FLIP_DURATION = 380;
const STAGGER = 90;
const INITIAL_PAUSE = 350; // pause before flip begins

function DrumDigit({
  digit,
  reveal,
  delay,
  onRevealed,
}: {
  digit: string;
  reveal: boolean;
  delay: number;
  onRevealed?: () => void;
}) {
  const y = useSharedValue(0); // starts at dot (index 0)

  useEffect(() => {
    if (reveal) {
      y.value = withDelay(
        delay,
        withTiming(-DIGIT_H, {
          duration: FLIP_DURATION,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished && onRevealed) runOnJS(onRevealed)();
        }),
      );
    } else {
      y.value = 0;
    }
  }, [reveal, digit]);

  const drumStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <View style={styles.pinBox}>
      <Animated.View style={drumStyle}>
        <View style={styles.digitSlot}>
          <Text style={styles.pinDigit}>•</Text>
        </View>
        <View style={styles.digitSlot}>
          <Text style={styles.pinDigit}>{digit}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ViewPinSheet({
  visible,
  pin,
  onClose,
}: {
  visible: boolean;
  pin: string;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_HIDE_SECONDS);
  const [expired, setExpired] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const progress = useSharedValue(0);

  // Start countdown only after flip animation finishes
  const startTimer = useCallback(() => {
    if (timerRunning) return;
    setTimerRunning(true);
    progress.value = withTiming(1, {
      duration: AUTO_HIDE_SECONDS * 1000,
      easing: Easing.linear,
    });
  }, [timerRunning]);

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(AUTO_HIDE_SECONDS);
      setExpired(false);
      setRevealed(false);
      setTimerRunning(false);
      progress.value = 0;
      return;
    }
    // Kick off the drum flip after a short pause
    const t = setTimeout(() => setRevealed(true), INITIAL_PAUSE);
    return () => clearTimeout(t);
  }, [visible]);

  // Tick the seconds display
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); setExpired(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (expired) onClose();
  }, [expired]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * progress.value,
  }));

  const digits = pin.split('');
  const lastIndex = digits.length - 1;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.iconWrap}>
        <Shield size={26} color={colors.brand} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>Your PIN</Text>
      <Text style={styles.body}>
        Make sure no one can see your screen. Never share your PIN with anyone.
      </Text>
      <View style={styles.pinRow}>
        {digits.map((digit, i) => (
          <DrumDigit
            key={i}
            digit={digit}
            reveal={revealed}
            delay={i * STAGGER}
            onRevealed={i === lastIndex ? startTimer : undefined}
          />
        ))}
      </View>

      <Text style={styles.timerLabel}>Auto-hides in</Text>
      <View style={styles.timerWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
          {/* Track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={R}
            stroke={colors.border}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Animated arc */}
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={R}
            stroke={colors.brand}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <Text style={styles.timerText}>{secondsLeft}s</Text>
      </View>

      <FlatButton onPress={onClose} label="Close" style={styles.closeBtn} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  pinRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  pinBox: {
    width: 52,
    height: BOX_H,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    overflow: 'hidden',
  },
  digitSlot: {
    height: BOX_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigit: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  timerLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    transform: [{ scaleX: -1 }],
  },
  timerText: {
    position: 'absolute',
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  closeBtn: { width: '100%', marginTop: spacing.lg, paddingVertical: spacing.md },
});
