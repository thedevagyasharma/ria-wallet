import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Share,
  Dimensions,
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
import { X, ChevronDown, Check, Copy, Share2, DollarSign } from 'lucide-react-native';
import FlatButton from '../../components/FlatButton';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius } from '../../theme';
import { alpha } from '../../utils/color';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import { MOCK_PROFILE } from '../../data/mockData';
import FlagIcon from '../../components/FlagIcon';
import BottomSheet from '../../components/BottomSheet';
import PrimaryButton from '../../components/PrimaryButton';
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
  const params = new URLSearchParams({ name: MOCK_PROFILE.name, phone: MOCK_PROFILE.phone, currency });
  if (amount && amount > 0) params.set('amount', String(amount));
  return `ria://pay?${params.toString()}`;
}

const ease = Easing.out(Easing.cubic);

// ─── Action circle ────────────────────────────────────────────────────────────

function ActionCircle({ icon, label, onPress, accent }: {
  icon: React.ReactNode; label: string; onPress: () => void; accent: string;
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReceiveMoneyScreen({ route }: RootStackProps<'ReceiveMoney'>) {
  const navigation = useNavigation<Nav>();
  const { wallets } = useWalletStore();
  const insets = useSafeAreaInsets();

  const initialWallet = wallets.find(w => w.id === route.params.walletId) ?? wallets[0];
  const [walletId, setWalletId]               = useState(initialWallet.id);
  const [showPicker, setShowPicker]           = useState(false);
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [copied, setCopied]                   = useState(false);
  const [requestAmountStr, setRequestAmountStr] = useState('');
  const [committedAmountStr, setCommittedAmountStr] = useState('');
  const prevAmountRef = useRef('');

  const wallet           = wallets.find(w => w.id === walletId) ?? wallets[0];
  const currency         = getCurrency(wallet.currency);
  const accent           = walletAccent(wallet.currency, wallet.accentColor);
  const committedAmount  = parseFloat(committedAmountStr) || 0;

  // Sync editing state from committed value when sheet opens
  useEffect(() => {
    if (showRequestSheet) {
      setRequestAmountStr(committedAmountStr);
      prevAmountRef.current = committedAmountStr;
    }
  }, [showRequestSheet]);

  const payload = useMemo(
    () => buildPayload(wallet.currency, committedAmount > 0 ? committedAmount : undefined),
    [wallet.currency, committedAmount],
  );

  // ── Entrance animation ──
  const qrO = useSharedValue(0); const qrY = useSharedValue(10);
  const actO = useSharedValue(0); const actY = useSharedValue(8);
  useEffect(() => {
    qrO.value  = withTiming(1, { duration: 420, easing: ease });
    qrY.value  = withTiming(0, { duration: 420, easing: ease });
    actO.value = withDelay(160, withTiming(1, { duration: 420, easing: ease }));
    actY.value = withDelay(160, withTiming(0, { duration: 420, easing: ease }));
  }, []);
  const qrAnim  = useAnimatedStyle(() => ({ opacity: qrO.value,  transform: [{ translateY: qrY.value  }] }));
  const actAnim = useAnimatedStyle(() => ({ opacity: actO.value, transform: [{ translateY: actY.value }] }));

  // ── Handlers ──
  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(payload);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [payload]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = committedAmount > 0
      ? `Send me ${formatAmount(committedAmount, wallet.currency)} via Ria: ${payload}`
      : `Send me money via Ria: ${payload}`;
    await Share.share({ message: msg });
  }, [payload, committedAmount, wallet.currency]);

  const dismiss = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
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
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPicker(true); }}
            style={styles.currencyPill}
          >
            <FlagIcon code={currency.flag} size={14} />
            <Text style={styles.currencyPillText}>{currency.code}</Text>
            <ChevronDown size={14} color={colors.textSecondary} strokeWidth={2.5} />
          </Pressable>

          <View style={styles.qrCard}>
            <QRCode
              value={payload}
              size={QR_SIZE}
              color={colors.textPrimary}
              backgroundColor="transparent"
            />
          </View>

          {committedAmount > 0 && (
            <Pressable
              onPress={() => { setCommittedAmountStr(''); setRequestAmountStr(''); prevAmountRef.current = ''; }}
              style={[styles.requestBadge, { backgroundColor: alpha(accent, 0.08), borderColor: alpha(accent, 0.2) }]}
            >
              <Text style={[styles.requestBadgeText, { color: accent }]}>
                Requesting {formatAmount(committedAmount, wallet.currency)}
              </Text>
              <X size={11} color={accent} strokeWidth={2.5} />
            </Pressable>
          )}

          <Text style={styles.userName}>{MOCK_PROFILE.name}</Text>
          <Text style={styles.userPhone}>{MOCK_PROFILE.phone}</Text>
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View style={[styles.actionsRow, actAnim]}>
          <ActionCircle
            icon={copied
              ? <Check size={20} color={colors.success} strokeWidth={2} />
              : <Copy size={20} color={accent} strokeWidth={1.8} />}
            label={copied ? 'Copied!' : 'Copy'}
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
            icon={<DollarSign size={20} color={committedAmount > 0 ? colors.success : accent} strokeWidth={1.8} />}
            label={committedAmount > 0 ? 'Adjust' : 'Request'}
            onPress={() => setShowRequestSheet(true)}
            accent={committedAmount > 0 ? colors.success : accent}
          />
        </Animated.View>
      </ScrollView>

      {/* ── Wallet picker ── */}
      <BottomSheet visible={showPicker} onClose={() => setShowPicker(false)} swipeToDismiss>
        <Text style={styles.sheetTitle}>Receive into</Text>
        <View style={styles.pickerRows}>
          {wallets.map((w, i) => {
            const c      = getCurrency(w.currency);
            const wAccent = walletAccent(w.currency, w.accentColor);
            const active  = w.id === walletId;
            return (
              <Pressable
                key={w.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWalletId(w.id); setShowPicker(false); }}
                style={[styles.pickerRow, active && styles.pickerRowActive, i < wallets.length - 1 && styles.pickerRowDivider]}
              >
                <View style={styles.pickerRowLeft}>
                  <FlagIcon code={c.flag} size={22} />
                  <View>
                    <Text style={styles.pickerCode}>{c.code}</Text>
                    <Text style={styles.pickerName}>{w.nickname ?? c.name}</Text>
                  </View>
                </View>
                <View style={styles.pickerRowRight}>
                  <Text style={styles.pickerBalance}>{formatAmount(w.balance, w.currency)}</Text>
                  {active && <Check size={18} color={colors.textPrimary} strokeWidth={2.5} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* ── Request amount sheet ── */}
      <BottomSheet visible={showRequestSheet} onClose={() => setShowRequestSheet(false)} swipeToDismiss>
        <Text style={styles.sheetTitle}>Request amount</Text>
        <Text style={styles.sheetSub}>Leave blank to accept any amount</Text>
        <View style={styles.requestAmountWrap}>
          <Text style={styles.requestCurrencyCode}>{currency.code}</Text>
          <TextInput
            style={styles.requestInput}
            value={requestAmountStr}
            onChangeText={(text) => {
              // reject pastes (more than 1 char added at once)
              if (text.length - prevAmountRef.current.length > 1) return;
              prevAmountRef.current = text;
              setRequestAmountStr(text);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
        </View>
        <View style={styles.requestActions}>
          <PrimaryButton
            label="Done"
            onPress={() => { setCommittedAmountStr(requestAmountStr); setShowRequestSheet(false); }}
            style={styles.requestApplyBtn}
          />
          <FlatButton
            label={requestAmountStr ? 'Clear' : 'Cancel'}
            onPress={requestAmountStr
              ? () => { prevAmountRef.current = ''; setRequestAmountStr(''); }
              : () => setShowRequestSheet(false)}
            style={styles.requestClearBtn}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 36 },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, alignItems: 'center' },

  // ── QR Hero ──
  qrHero: { alignItems: 'center', marginBottom: spacing.xxxl },
  currencyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    backgroundColor: colors.surface, borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  currencyPillText: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary },

  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  requestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 5,
    marginBottom: spacing.md,
  },
  requestBadgeText: { fontSize: typography.xs, fontWeight: typography.semibold },

  userName: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold, marginBottom: spacing.xs },
  userPhone: { fontSize: typography.sm, color: colors.textSecondary },

  // ── Actions ──
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl, marginBottom: spacing.xxl },
  actionCircleWrap: { alignItems: 'center', gap: spacing.sm },
  actionCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actionCircleOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
  actionCircleLabel: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium },

  // ── Sheets ──
  sheetTitle: {
    fontSize: typography.md, fontWeight: typography.semibold,
    color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center',
  },
  sheetSub: {
    fontSize: typography.sm, color: colors.textMuted,
    textAlign: 'center', marginBottom: spacing.lg,
  },

  pickerRows: { width: '100%', marginTop: spacing.sm },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: spacing.xl, marginHorizontal: -spacing.xl,
  },
  pickerRowActive: { backgroundColor: colors.surface },
  pickerRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pickerRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pickerCode:     { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  pickerName:     { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  pickerRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pickerBalance:  { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.regular },

  requestAmountWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.xl, gap: spacing.xs,
  },
  requestCurrencyCode: {
    fontSize: typography.sm, color: colors.textMuted,
    fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  requestInput: {
    fontSize: 44, fontWeight: typography.bold,
    color: colors.textPrimary, textAlign: 'center',
    minWidth: 120, letterSpacing: -1,
  },
  requestActions: { width: '100%', gap: spacing.xs, paddingTop: spacing.sm, alignItems: 'center' },
  requestApplyBtn: { width: '100%', paddingVertical: spacing.lg },
  requestClearBtn: { paddingVertical: spacing.md },
});
