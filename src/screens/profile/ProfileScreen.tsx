import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { authenticate } from '../../utils/auth';
import {
  Eye,
  EyeOff,
  Lock,
  ChevronRight,
  Star,
  HelpCircle,
  FileText,
  Shield,
  ArrowUpRight,
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { alpha } from '../../utils/color';
import { useWalletStore } from '../../stores/useWalletStore';
import SetPrimarySheet from '../../components/SetPrimarySheet';
import { usePrefsStore } from '../../stores/usePrefsStore';
import { getCurrency } from '../../data/currencies';
import FlatButton from '../../components/FlatButton';
import FlagIcon from '../../components/FlagIcon';

const H_PAD = 24;

const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};
function walletAccent(c: string, override?: string) { return override ?? WALLET_ACCENTS[c] ?? colors.brand; }

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
  onPress,
  toggle,
  toggleValue,
  destructive,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  destructive?: boolean;
  last?: boolean;
}) {
  const inner = (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>{icon}</View>
        <Text style={[styles.rowLabel, destructive && { color: colors.failed }]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {toggle ? (
          <Switch
            value={toggleValue}
            onValueChange={onPress}
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor="#fff"
          />
        ) : (
          <>
            {value ? <Text style={styles.rowValue}>{value}</Text> : null}
            <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
          </>
        )}
      </View>
    </View>
  );

  return (
    <>
      {toggle ? inner : (
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onPress?.(); }}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          {inner}
        </Pressable>
      )}
      {!last && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Wallet row ───────────────────────────────────────────────────────────────

function WalletRow({
  wallet,
  onSetPrimary,
  last,
}: {
  wallet: { id: string; currency: string; balance: number; isPrimary: boolean; nickname?: string; accentColor?: string };
  onSetPrimary: () => void;
  last?: boolean;
}) {
  const currency = getCurrency(wallet.currency);
  const accent   = walletAccent(wallet.currency, wallet.accentColor);
  const label    = wallet.nickname ?? currency.code;

  return (
    <>
    <View style={styles.walletRow}>
      {/* Left: flag + name */}
      <View style={styles.walletRowLeft}>
        <View style={styles.walletFlagSlot}>
          <FlagIcon code={currency.flag} size={18} />
        </View>
        <Text style={styles.walletLabel}>{label}</Text>
      </View>

      {/* Right: primary badge or set-primary button */}
      {wallet.isPrimary ? (
        <View style={[styles.primaryBadge, { backgroundColor: alpha(accent, 0.1), borderColor: alpha(accent, 0.25) }]}>
          <Star size={10} color={accent} strokeWidth={2.5} fill={accent} />
          <Text style={[styles.primaryBadgeText, { color: accent }]}>Primary</Text>
        </View>
      ) : (
        <FlatButton
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSetPrimary(); }}
          style={styles.setPrimaryBtn}
        >
          <Text style={styles.setPrimaryText}>Set primary</Text>
        </FlatButton>
      )}
    </View>
    {!last && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { wallets, setPrimary } = useWalletStore();
  const { hideBalances, appLockEnabled, defaultSendCurrency, toggleHideBalances, toggleAppLock } =
    usePrefsStore();

  const [primarySheet, setPrimarySheet] = useState<{ id: string; label: string } | null>(null);

  function handleSetPrimary(id: string, label: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrimarySheet({ id, label });
  }

  function confirmSetPrimary() {
    if (!primarySheet) return;
    setPrimary(primarySheet.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPrimarySheet(null);
  }

  const handleToggleAppLock = useCallback(async () => {
    const result = await authenticate(
      appLockEnabled ? 'Confirm to disable app lock' : 'Confirm to enable app lock',
    );
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toggleAppLock();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [appLockEnabled, toggleAppLock]);

  function stub() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User block ──────────────────────────────────────────────────── */}
        <View style={styles.userBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>CM</Text>
          </View>
          <Text style={styles.userName}>Carlos Mendez</Text>
          <Text style={styles.userSub}>Member since Jan 2024</Text>
        </View>

        {/* ── Wallets ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Wallets" />
          {wallets.map((w, i) => (
            <WalletRow
              key={w.id}
              wallet={w}
              onSetPrimary={() => handleSetPrimary(w.id, w.nickname ?? getCurrency(w.currency).code)}
              last={i === wallets.length - 1}
            />
          ))}
        </View>

        {/* ── Preferences ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Preferences" />
          <Row
            icon={hideBalances
              ? <EyeOff size={18} color={colors.textSecondary} strokeWidth={1.8} />
              : <Eye size={18} color={colors.textSecondary} strokeWidth={1.8} />
            }
            label="Hide balances by default"
            toggle
            toggleValue={hideBalances}
            onPress={toggleHideBalances}
          />
          <Row
            icon={<ArrowUpRight size={18} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Default send currency"
            value={defaultSendCurrency}
            onPress={stub}
            last
          />
        </View>

        {/* ── Security ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Security" />
          <Row
            icon={<Lock size={18} color={colors.textSecondary} strokeWidth={1.8} />}
            label="App lock"
            toggle
            toggleValue={appLockEnabled}
            onPress={handleToggleAppLock}
          />
          <Row
            icon={<Shield size={18} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Change PIN"
            onPress={stub}
            last
          />
        </View>

        {/* ── Support ─────────────────────────────────────────────────────── */}
        <View style={[styles.section, styles.sectionLast]}>
          <SectionLabel label="Support" />
          <Row
            icon={<HelpCircle size={18} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Help center"
            onPress={stub}
          />
          <Row
            icon={<FileText size={18} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Privacy policy"
            onPress={stub}
          />
          <Row
            icon={<FileText size={18} color={colors.textSecondary} strokeWidth={1.8} />}
            label="Terms of service"
            onPress={stub}
            last
          />
        </View>

        <Text style={styles.version}>Ria Wallet v1.0.0</Text>
      </ScrollView>

      <SetPrimarySheet
        visible={primarySheet !== null}
        walletLabel={primarySheet?.label ?? ''}
        onConfirm={confirmSetPrimary}
        onCancel={() => setPrimarySheet(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },

  // ── User block ──
  userBlock: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: typography.xl,
    color: '#fff',
    fontWeight: typography.bold,
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  userSub: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: H_PAD,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sectionLast: {
    paddingBottom: 0,
    marginBottom: spacing.xxxl,
    borderBottomWidth: 0,
  },

  // ── Section label ──
  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },

  // ── Generic row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 22, alignItems: 'center' },
  rowLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowValue: { fontSize: typography.sm, color: colors.textMuted },

  // ── Wallet row ──
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  walletRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  walletFlagSlot: { width: 27, alignItems: 'center', justifyContent: 'center' },
  walletLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },

  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  primaryBadgeText: { fontSize: 11, fontWeight: typography.semibold },

  setPrimaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  setPrimaryText: { fontSize: 11, color: colors.textSecondary, fontWeight: typography.medium },

  // ── Footer ──
  version: {
    textAlign: 'center',
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.xxl,
  },
});
