import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import { CURRENCIES } from '../../data/currencies';
import FlagIcon from '../../components/FlagIcon';
import Chip from '../../components/Chip';
import { useWalletStore } from '../../stores/useWalletStore';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CurrencyPickerScreen() {
  const navigation = useNavigation<Nav>();
  const { wallets } = useWalletStore();
  const ownedCodes = new Set(wallets.map((w) => w.currency));

  const handleSelect = (code: string) => {
    if (ownedCodes.has(code)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AddWalletName', { currency: code });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Add wallet</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>Choose a currency for your new wallet.</Text>

      {/* List */}
      <FlatList
        data={CURRENCIES}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const owned = ownedCodes.has(item.code);
          return (
            <Pressable
              onPress={() => handleSelect(item.code)}
              disabled={owned}
              style={({ pressed }) => [
                styles.row,
                pressed && !owned && { backgroundColor: colors.surfaceHigh },
              ]}
            >
              <FlagIcon code={item.flag} size={24} style={styles.rowFlag} />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, owned && styles.textDisabled]}>
                  {item.name}
                </Text>
                <Text style={[styles.rowCode, owned && styles.textDisabled]}>
                  {item.code}
                </Text>
              </View>
              {owned && (
                <Chip label="Added" color={colors.textMuted} bg={colors.surfaceHigh} size="sm" />
              )}
            </Pressable>
          );
        }}
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
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },

  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  separator: { height: 1, backgroundColor: colors.borderSubtle },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderRadius: radius.sm,
  },
  rowFlag: { width: 36, alignSelf: 'center' },
  rowText: { flex: 1 },
  rowName: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  rowCode: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  textDisabled: { color: colors.textMuted },

});
