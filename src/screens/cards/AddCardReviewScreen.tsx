import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import PrimaryButton from '../../components/PrimaryButton';
import { useCardStore } from '../../stores/useCardStore';
import { getCurrency } from '../../data/currencies';
import { CardFront, CARD_HEIGHT } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Card, CardType } from '../../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_LABELS: Record<CardType, string> = {
  physical: 'Physical card',
  virtual: 'Virtual card',
  'single-use': 'Single-use card',
};

export default function AddCardReviewScreen({ route }: RootStackProps<'AddCardReview'>) {
  const navigation = useNavigation<Nav>();
  const { walletId, cardType, name, color } = route.params;
  const { wallets } = useWalletStore();
  const { addCard } = useCardStore();
  const wallet = wallets.find((w) => w.id === walletId)!;
  const currency = getCurrency(wallet.currency);

  const [confirmed, setConfirmed] = React.useState(false);

  // Animations
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const confirmScale = useSharedValue(0);
  const confirmOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 160 });
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: confirmScale.value }],
    opacity: confirmOpacity.value,
  }));

  // Build preview card
  const previewCard: Card = {
    id: 'preview',
    walletId,
    name,
    color,
    last4: '0000',
    network: 'Visa',
    cardholderName: 'YOUR NAME',
    expiry: 'MM/YY',
    cvv: '000',
    fullNumber: '0000 0000 0000 0000',
    frozen: false,
    type: cardType as CardType,
  };

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const networks = ['Visa', 'Mastercard'] as const;
    const network = networks[Math.floor(Math.random() * networks.length)];
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const prefix = network === 'Visa' ? '4' : '5';
    const fullNumber = `${prefix}${Math.random().toString().slice(2, 6)} ${Math.random().toString().slice(2, 6)} ${Math.random().toString().slice(2, 6)} ${last4}`;
    const month = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
    const year = String(27 + Math.floor(Math.random() * 4));

    addCard({
      id: `card-${Date.now()}`,
      walletId,
      name,
      color,
      last4,
      network,
      cardholderName: 'Carlos Mendez',
      expiry: `${month}/${year}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      fullNumber,
      frozen: false,
      type: cardType as CardType,
    });

    setConfirmed(true);
    confirmScale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 180 }));
    confirmOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
  }, [addCard, walletId, name, color, cardType, confirmScale, confirmOpacity]);

  if (confirmed) {
    return (
      <SafeAreaView style={[styles.safe, styles.successSafe]} edges={['top', 'bottom']}>
        <Animated.View style={[styles.successContent, successStyle]}>
          <View style={styles.successCardWrap}>
            <CardFront card={{ ...previewCard, last4: '0000', cardholderName: 'Carlos Mendez' }} currency={currency.code} />
          </View>
          <Text style={styles.successTitle}>Card added!</Text>
          <Text style={styles.successSub}>
            "{name}" is ready to use.
          </Text>
        </Animated.View>
        <View style={styles.footer}>
          <PrimaryButton onPress={() => navigation.popToTop()} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Done</Text>
          </PrimaryButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Review</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Card preview */}
        <Animated.View style={[styles.cardPreviewWrap, cardAnimStyle]}>
          <CardFront card={previewCard} currency={currency.code} />
        </Animated.View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Row label="Card name" value={name} />
          <Divider />
          <Row label="Type" value={TYPE_LABELS[cardType as CardType]} />
          <Divider />
          <Row label="Wallet" value={`${currency.flag} ${currency.name}`} />
          <Divider />
          <Row
            label="Issuance fee"
            value={cardType === 'physical' ? '$4.99' : 'Free'}
            valueColor={cardType === 'physical' ? colors.pending : colors.success}
          />
        </View>

        {cardType === 'physical' && (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>
              💳  Your physical card will be delivered in 5–7 business days. A virtual card for this wallet is available immediately.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton onPress={handleConfirm} style={styles.confirmBtn}>
          <Text style={styles.confirmBtnText}>
            {cardType === 'physical' ? 'Confirm & pay $4.99' : 'Add card'}
          </Text>
        </PrimaryButton>
        <Pressable onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  successSafe: { justifyContent: 'space-between' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  cardPreviewWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowLabel: { fontSize: typography.base, color: colors.textSecondary },
  rowValue: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold, flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.borderSubtle },

  noticeBanner: {
    backgroundColor: colors.pendingSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { fontSize: typography.sm, color: colors.pending, lineHeight: 20 },

  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
  confirmBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { fontSize: typography.base, color: colors.textSecondary },

  // Success
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  successCardWrap: { marginBottom: spacing.md },
  successTitle: { fontSize: typography.xxl, color: colors.textPrimary, fontWeight: typography.bold },
  successSub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  doneBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  doneBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
});
