import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  X,
  Pencil,
  Star,
  Check,
  Palette,
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { alpha } from '../../utils/color';
import { useWalletStore } from '../../stores/useWalletStore';
import SetPrimarySheet from '../../components/SetPrimarySheet';
import { getCurrency, formatAmount } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import type { RootStackParamList, RootStackProps } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RootStackProps<'WalletSettings'>['route'];

const H_PAD = 24;

// ─── Accent palette ───────────────────────────────────────────────────────────

const ACCENT_PALETTE = [
  '#2563eb', '#0284c7', '#0d9488', '#059669',
  '#16a34a', '#ca8a04', '#d97706', '#ea580c',
  '#dc2626', '#9333ea', '#4f46e5', '#6d28d9',
  '#db2777', '#0891b2', '#475569', '#374151',
];

const WALLET_ACCENTS_DEFAULT: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};

function defaultAccent(currency: string) {
  return WALLET_ACCENTS_DEFAULT[currency] ?? colors.brand;
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WalletSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Route;
  const { walletId } = route.params;

  const { wallets, setPrimary, setNickname, setAccentColor } = useWalletStore();
  const wallet = wallets.find((w) => w.id === walletId) ?? wallets[0];

  const [showPrimarySheet, setShowPrimarySheet] = useState(false);

  const currency    = getCurrency(wallet.currency);
  const accent      = useMemo(() => wallet.accentColor ?? defaultAccent(wallet.currency), [wallet.accentColor, wallet.currency]);
  const walletLabel = wallet.nickname ?? currency.code;

  function handleRename() {
    Alert.prompt(
      'Rename wallet',
      'Give this wallet a custom name',
      (text) => {
        const trimmed = text?.trim();
        if (trimmed) setNickname(walletId, trimmed);
      },
      'plain-text',
      walletLabel,
    );
  }

  function handleSetPrimary() {
    if (wallet.isPrimary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPrimarySheet(true);
  }


  function confirmSetPrimary() {
    setShowPrimarySheet(false);
    setPrimary(walletId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleColorSelect(color: string) {
    Haptics.selectionAsync();
    setAccentColor(walletId, color);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.walletIcon, { backgroundColor: alpha(accent, 0.12) }]}>
          <FlagIcon code={currency.flag} size={22} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{walletLabel}</Text>
          <Text style={styles.headerSub}>{currency.name}</Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
        >
          <X size={20} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Name ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Wallet name" />
          <Pressable
            onPress={() => { Haptics.selectionAsync(); handleRename(); }}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.rowLeft}>
              <View style={styles.rowIcon}>
                <Pencil size={17} color={colors.textSecondary} strokeWidth={1.8} />
              </View>
              <Text style={styles.rowLabel}>{walletLabel}</Text>
            </View>
            <Text style={styles.rowAction}>Rename</Text>
          </Pressable>
        </View>

        {/* ── Accent color ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Accent color" />
          <View style={styles.paletteHeader}>
            <View style={styles.rowIcon}>
              <Palette size={17} color={colors.textSecondary} strokeWidth={1.8} />
            </View>
            <Text style={styles.rowLabel}>Wallet color</Text>
            <View style={[styles.currentSwatch, { backgroundColor: accent }]} />
          </View>
          <View style={styles.paletteGrid}>
            {ACCENT_PALETTE.map((color) => {
              const selected = accent === color;
              return (
                <Pressable
                  key={color}
                  onPress={() => handleColorSelect(color)}
                  style={({ pressed }) => [
                    styles.swatch,
                    { backgroundColor: color },
                    selected && styles.swatchSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {selected && (
                    <Check size={14} color="#fff" strokeWidth={3} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Primary ───────────────────────────────────────────────────── */}
        <View style={[styles.section, styles.sectionLast]}>
          <SectionLabel label="Wallet options" />
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSetPrimary(); }}
            style={({ pressed }) => [styles.row, pressed && !wallet.isPrimary && { opacity: 0.6 }]}
          >
            <View style={styles.rowLeft}>
              <View style={styles.rowIcon}>
                <Star
                  size={17}
                  color={wallet.isPrimary ? accent : colors.textSecondary}
                  strokeWidth={1.8}
                  fill={wallet.isPrimary ? accent : 'none'}
                />
              </View>
              <View>
                <Text style={[styles.rowLabel, wallet.isPrimary && { color: accent }]}>Primary wallet</Text>
                <Text style={styles.rowSub}>
                  {wallet.isPrimary ? 'This is your primary wallet' : 'Set as your default wallet'}
                </Text>
              </View>
            </View>
            {wallet.isPrimary ? (
              <View style={[styles.primaryBadge, { backgroundColor: alpha(accent, 0.1), borderColor: alpha(accent, 0.25) }]}>
                <Text style={[styles.primaryBadgeText, { color: accent }]}>Active</Text>
              </View>
            ) : (
              <Text style={styles.rowAction}>Set</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <SetPrimarySheet
        visible={showPrimarySheet}
        walletLabel={walletLabel}
        onConfirm={confirmSetPrimary}
        onCancel={() => setShowPrimarySheet(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletFlag: {},
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  headerSub: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  rowSub: { fontSize: typography.xs, color: colors.textMuted, marginTop: 1 },
  rowAction: { fontSize: typography.sm, color: colors.brand, fontWeight: typography.semibold },

  // ── Palette ──
  paletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  currentSwatch: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    marginLeft: 'auto',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },

  // ── Primary badge ──
  primaryBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  primaryBadgeText: { fontSize: 11, fontWeight: typography.semibold },
});
