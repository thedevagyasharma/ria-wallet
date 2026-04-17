import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import SecondaryButton from '../../components/SecondaryButton';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing } from '../../theme';
import { getCurrency } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import { useWalletStore } from '../../stores/useWalletStore';
import type { RootStackParamList, RootStackProps } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WalletSuccessScreen({ route }: RootStackProps<'WalletSuccess'>) {
  const navigation = useNavigation<Nav>();
  const { currency: code, walletId } = route.params;
  const currency = getCurrency(code);
  const markJustAddedWallet = useWalletStore((s) => s.markJustAddedWallet);

  // Gentle fade + rise — no spring/bounce.
  const flagProgress = useSharedValue(0);
  const titleProgress = useSharedValue(0);
  const subtitleProgress = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const ease = Easing.out(Easing.cubic);
    flagProgress.value = withTiming(1, { duration: 420, easing: ease });
    titleProgress.value = withDelay(120, withTiming(1, { duration: 420, easing: ease }));
    subtitleProgress.value = withDelay(260, withTiming(1, { duration: 420, easing: ease }));
  }, []);

  const flagStyle = useAnimatedStyle(() => ({
    opacity: flagProgress.value,
    transform: [{ translateY: interpolate(flagProgress.value, [0, 1], [8, 0]) }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleProgress.value,
    transform: [{ translateY: interpolate(titleProgress.value, [0, 1], [10, 0]) }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleProgress.value,
    transform: [{ translateY: interpolate(subtitleProgress.value, [0, 1], [10, 0]) }],
  }));

  const handleDone = () => {
    markJustAddedWallet(walletId);
    navigation.popToTop();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Animated.View style={flagStyle}>
          <FlagIcon code={currency.flag} size={72} />
        </Animated.View>

        <Animated.Text style={[styles.title, titleStyle]}>
          {code} Wallet Created.
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          Your {currency.name} wallet is ready to use.
        </Animated.Text>
      </View>

      <View style={styles.footer}>
        <SecondaryButton onPress={handleDone} style={styles.doneBtn} label="Done" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  doneBtn: {
    paddingVertical: spacing.lg,
  },
});
