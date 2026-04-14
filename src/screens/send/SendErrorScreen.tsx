import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TrendingDown, AlertTriangle } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import PrimaryButton from '../../components/PrimaryButton';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ErrorConfig = {
  icon: React.ReactNode;
  title: string;
  body: string;
  primaryLabel: string;
  primaryAction: (nav: Nav) => void;
  secondaryLabel: string;
  secondaryAction: (nav: Nav) => void;
};

const ERROR_CONFIGS: Record<'insufficient_funds' | 'transfer_failed', ErrorConfig> = {
  insufficient_funds: {
    icon: <TrendingDown size={52} color={colors.failed} strokeWidth={1.5} />,
    title: 'Insufficient funds',
    body: "Your wallet doesn't have enough balance to cover this transfer including fees. Add funds or reduce the amount.",
    primaryLabel: 'Change amount',
    primaryAction: (nav) => nav.goBack(),
    secondaryLabel: 'Back to wallets',
    secondaryAction: (nav) => nav.popToTop(),
  },
  transfer_failed: {
    icon: <AlertTriangle size={52} color={colors.failed} strokeWidth={1.5} />,
    title: 'Transfer failed',
    body: "Something went wrong on our end and the transfer couldn't be completed. No money has been deducted. Please try again.",
    primaryLabel: 'Try again',
    primaryAction: (nav) => nav.goBack(),
    secondaryLabel: 'Back to wallets',
    secondaryAction: (nav) => nav.popToTop(),
  },
};

export default function SendErrorScreen({ route }: RootStackProps<'SendError'>) {
  const navigation = useNavigation<Nav>();
  const { reason } = route.params;
  const config = ERROR_CONFIGS[reason];

  const iconScale   = useSharedValue(0);
  const iconShake   = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    iconScale.value = withSpring(1, { damping: 10, stiffness: 160 });

    // Small shake after appear
    iconShake.value = withDelay(300, withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10,  { duration: 60 }),
      withTiming(-6,  { duration: 60 }),
      withTiming(6,   { duration: 60 }),
      withTiming(0,   { duration: 60 })
    ));

    contentOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { translateX: iconShake.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <View style={styles.iconRing}>
            {config.icon}
          </View>
        </Animated.View>

        <Animated.View style={[styles.textBlock, contentStyle]}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.body}>{config.body}</Text>

          {reason === 'insufficient_funds' && (
            <View style={styles.tipBox}>
              <Text style={styles.tipText}>
                💡  You can add funds from a linked bank account or card in Settings.
              </Text>
            </View>
          )}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton onPress={() => config.primaryAction(navigation)} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>{config.primaryLabel}</Text>
        </PrimaryButton>
        <Pressable
          onPress={() => config.secondaryAction(navigation)}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryBtnText}>{config.secondaryLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },

  iconWrap: { alignItems: 'center' },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.failedSubtle,
    borderWidth: 2,
    borderColor: colors.failed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textBlock: { alignItems: 'center', gap: spacing.md },
  title: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  tipBox: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  tipText: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  primaryBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
  secondaryBtn: { alignItems: 'center', paddingVertical: spacing.md },
  secondaryBtnText: { fontSize: typography.base, color: colors.textSecondary },
});
