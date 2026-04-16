import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from '../../components/PrimaryButton';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius } from '../../theme';
import { getCurrency } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import type { RootStackParamList, RootStackProps } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WalletSuccessScreen({ route }: RootStackProps<'WalletSuccess'>) {
  const navigation = useNavigation<Nav>();
  const { currency: code } = route.params;
  const currency = getCurrency(code);

  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 300 });
    checkScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 200 }));
    subtitleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: interpolate(subtitleOpacity.value, [0, 1], [12, 0]) }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.brandSubtle, colors.bg]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Animated.View style={[styles.circle, circleStyle]}>
          <FlagIcon code={currency.flag} size={56} />
        </Animated.View>

        <Text style={styles.title}>Wallet created!</Text>

        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          Your {currency.name} ({code}) wallet is ready to use.
        </Animated.Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton onPress={() => navigation.popToTop()} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Done</Text>
        </PrimaryButton>
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
  circle: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  flag: {},
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
    alignItems: 'center',
  },
  doneBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
});
