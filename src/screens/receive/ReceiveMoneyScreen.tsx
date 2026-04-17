import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import {
  X,
  ChevronDown,
  Check,
  Copy,
  Share2,
  Link,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius } from '../../theme';
import { alpha } from '../../utils/color';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import { MOCK_PROFILE } from '../../data/mockData';
import FlagIcon from '../../components/FlagIcon';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: SCREEN_W } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_W - 120, 200);

const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};
function walletAccent(c: string, override?: string) { return override ?? WALLET_ACCENTS[c] ?? colors.brand; }

function buildPayload(currency: string, amount?: number) {
  const params = new URLSearchParams({
    name: MOCK_PROFILE.name,
    phone: MOCK_PROFILE.phone,
    currency,
  });
  if (amount && amount > 0) params.set('amount', String(amount));
  return `ria://pay?${params.toString()}`;
}

const ease = Easing.out(Easing.cubic);

// ─── Action circle button ────────────────────────────────────────────────────

function ActionCircle({ icon, label, onPress, accent }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionCircleWrap}>
      {({ pressed }) => (
        <>
          <View style={[styles.actionCircle, { backgroundColor: alpha(accent, 0.10) }]}>
            {pressed && <View style={styles.actionCircleOverlay} />}
            {icon}
          </View>
          <Text style={styles.actionCircleLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function ReceiveMoneyScreen({ route }: RootStackProps<'ReceiveMoney'>) {
  const navigation = useNavigation<Nav>();
  const { wallets } = useWalletStore();
  const insets = useSafeAreaInsets();

  const initialWallet = wallets.find(w => w.id === route.params.walletId) ?? wallets[0];
  const [walletId, setWalletId] = useState(initialWallet.id);
  const [showPicker, setShowPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const wallet = wallets.find(w => w.id === walletId) ?? wallets[0];
  const currency = getCurrency(wallet.currency);
  const accent = walletAccent(wallet.currency, wallet.accentColor);

  const payload = useMemo(
    () => buildPayload(wallet.currency),
    [wallet.currency],
  );

  // ── Staggered entrance ──
  const qrO = useSharedValue(0);
  const qrY = useSharedValue(10);
  const actionsO = useSharedValue(0);
  const actionsY = useSharedValue(8);

  useEffect(() => {
    qrO.value = withTiming(1, { duration: 420, easing: ease });
    qrY.value = withTiming(0, { duration: 420, easing: ease });
    actionsO.value = withDelay(160, withTiming(1, { duration: 420, easing: ease }));
    actionsY.value = withDelay(160, withTiming(0, { duration: 420, easing: ease }));
  }, []);

  const qrAnim = useAnimatedStyle(() => ({
    opacity: qrO.value,
    transform: [{ translateY: qrY.value }],
  }));
  const actionsAnim = useAnimatedStyle(() => ({
    opacity: actionsO.value,
    transform: [{ translateY: actionsY.value }],
  }));

  // ── Handlers ──
  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(payload);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [payload]);

  const handleCopyLink = useCallback(async () => {
    await Clipboard.setStringAsync(payload);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [payload]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message: `Send me money via Ria: ${payload}` });
  }, [payload]);

  const dismiss = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={dismiss} style={styles.closeBtn}>
          <X size={20} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Receive</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── QR Hero ── */}
        <Animated.View style={[styles.qrHero, qrAnim]}>
          {/* Currency pill */}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPicker(true); }}
            style={[styles.currencyPill, { borderColor: alpha(accent, 0.25), backgroundColor: alpha(accent, 0.06) }]}
          >
            <FlagIcon code={currency.flag} size={18} />
            <Text style={[styles.currencyPillText, { color: accent }]}>
              {currency.code}
            </Text>
            <ChevronDown size={14} color={accent} strokeWidth={2.5} />
          </Pressable>

          {/* QR card */}
          <View style={[styles.qrCard, { borderColor: alpha(accent, 0.15) }]}>
            <View style={[styles.qrInner, { backgroundColor: alpha(accent, 0.04) }]}>
              <QRCode
                value={payload}
                size={QR_SIZE}
                color={colors.textPrimary}
                backgroundColor="transparent"
              />
            </View>
          </View>

          {/* User info under QR */}
          <Text style={styles.userName}>{MOCK_PROFILE.name}</Text>
          <Text style={styles.userPhone}>{MOCK_PROFILE.phone}</Text>
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View style={[styles.actionsRow, actionsAnim]}>
          <ActionCircle
            icon={copied
              ? <Check size={20} color={colors.success} strokeWidth={2} />
              : <Copy size={20} color={accent} strokeWidth={1.8} />}
            label={copied ? 'Copied!' : 'Copy QR'}
            onPress={handleCopy}
            accent={copied ? colors.success : accent}
          />
          <ActionCircle
            icon={<Share2 size={20} color={accent} strokeWidth={1.8} />}
            label="Share"
            onPress={handleShare}
            accent={accent}
          />
          <ActionCircle
            icon={linkCopied
              ? <Check size={20} color={colors.success} strokeWidth={2} />
              : <Link size={20} color={accent} strokeWidth={1.8} />}
            label={linkCopied ? 'Copied!' : 'Copy link'}
            onPress={handleCopyLink}
            accent={linkCopied ? colors.success : accent}
          />
        </Animated.View>

      </ScrollView>

      {/* ── Wallet picker modal ── */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setShowPicker(false)}>
          <View style={[styles.dropdownPanel, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.dropdownHandle} />
            <Text style={styles.dropdownTitle}>Receive into</Text>
            {wallets.map((w, i) => {
              const c = getCurrency(w.currency);
              const wAccent = walletAccent(w.currency, w.accentColor);
              const active = w.id === walletId;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setWalletId(w.id);
                    setShowPicker(false);
                  }}
                  style={[
                    styles.dropdownRow,
                    active && { backgroundColor: alpha(wAccent, 0.06) },
                    i < wallets.length - 1 && styles.dropdownRowDivider,
                  ]}
                >
                  <View style={styles.dropdownRowLeft}>
                    <FlagIcon code={c.flag} size={22} />
                    <View>
                      <Text style={styles.dropdownCode}>{c.code}</Text>
                      <Text style={styles.dropdownName}>{w.nickname ?? c.name}</Text>
                    </View>
                  </View>
                  <View style={styles.dropdownRowRight}>
                    <Text style={styles.dropdownBalance}>
                      {formatAmount(w.balance, w.currency)}
                    </Text>
                    {active && <Check size={18} color={wAccent} strokeWidth={2.5} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  title: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
  },

  // ── QR Hero ──
  qrHero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  currencyPillText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },

  qrCard: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: 4,
    marginBottom: spacing.lg,
  },
  qrInner: {
    borderRadius: radius.xl - 2,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  userName: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },

  // ── Amount ──
  // ── Actions ──
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  actionCircleWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionCircleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  actionCircleLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  // ── Wallet picker ──
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dropdownPanel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  dropdownHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dropdownTitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: 15,
  },
  dropdownRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dropdownCode: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  dropdownName: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  dropdownRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dropdownBalance: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.regular },
});
