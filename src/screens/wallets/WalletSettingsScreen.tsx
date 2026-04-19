import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Check,
  ChevronRight,
  Star,
  Pencil,
} from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { alpha } from '../../utils/color';
import Chip from '../../components/Chip';
import PrimaryButton from '../../components/PrimaryButton';
import { useWalletStore } from '../../stores/useWalletStore';
import SetPrimarySheet from '../../components/SetPrimarySheet';
import { getCurrency, formatAmount } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import type { RootStackParamList, RootStackProps } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RootStackProps<'WalletSettings'>['route'];

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
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Customize</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ── Identity ──────────────────────────────────────────────── */}
      <View style={styles.identity}>
        <FlagIcon code={currency.flag} size={28} style={{ borderRadius: 3 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.identityName}>{walletLabel}</Text>
          <Text style={styles.identitySub}>{currency.name}</Text>
        </View>
      </View>

      {/* ── Settings rows ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); handleRename(); }}
          style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.settingsRowLeft}>
            <View style={styles.settingsRowIcon}>
              <Pencil size={17} color={colors.textSecondary} strokeWidth={1.8} />
            </View>
            <Text style={styles.settingsRowLabel}>Wallet name</Text>
          </View>
          <View style={styles.settingsRowRight}>
            <Text style={styles.settingsRowValue}>{walletLabel}</Text>
            <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
          </View>
        </Pressable>

        <View style={styles.settingsRowDivider} />

        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSetPrimary(); }}
          style={({ pressed }) => [styles.settingsRow, pressed && !wallet.isPrimary && { opacity: 0.6 }]}
        >
          <View style={styles.settingsRowLeft}>
            <View style={styles.settingsRowIcon}>
              <Star
                size={17}
                color={wallet.isPrimary ? accent : colors.textSecondary}
                strokeWidth={1.8}
                fill={wallet.isPrimary ? accent : 'none'}
              />
            </View>
            <Text style={[styles.settingsRowLabel, wallet.isPrimary && { color: accent }]}>
              Primary wallet
            </Text>
          </View>
          {wallet.isPrimary ? (
            <Chip label="Active" color={accent} bg={alpha(accent, 0.1)} />
          ) : (
            <View style={styles.settingsRowRight}>
              <Text style={styles.settingsRowValue}>Set</Text>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Accent color ──────────────────────────────────────────── */}
      <View style={styles.colorSection}>
        <Text style={styles.colorLabel}>Accent color</Text>
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

      {/* ── Done button ───────────────────────────────────────────── */}
      <View style={styles.footer}>
        <PrimaryButton
          label="Done"
          onPress={() => navigation.goBack()}
          style={styles.doneBtn}
        />
      </View>

      <SetPrimarySheet
        visible={showPrimarySheet}
        walletLabel={walletLabel}
        onConfirm={confirmSetPrimary}
        onCancel={() => setShowPrimarySheet(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  identityName: {
    fontSize: typography.lg,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  identitySub: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 1,
  },

  section: {
    paddingHorizontal: spacing.xl,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  settingsRowDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingsRowIcon: { width: 22, alignItems: 'center' },
  settingsRowLabel: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingsRowValue: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },

  colorSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  colorLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    marginBottom: spacing.md,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 40,
    height: 40,
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

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    marginTop: 'auto',
  },
  doneBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
