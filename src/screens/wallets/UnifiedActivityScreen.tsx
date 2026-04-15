import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  SectionList,
  ScrollView,
  type SectionList as SectionListType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import StatusChip from '../../components/StatusChip';
import type { Transaction } from '../../stores/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';
import type { RootStackParamList } from '../../navigation/types';

const H_PAD = 24;

const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};
function walletAccent(c: string) { return WALLET_ACCENTS[c] ?? colors.brand; }
function alpha(hex: string, o: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${o})`;
}

function groupByMonth(txs: Transaction[]): { title: string; data: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(tx.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

// ─── Filter chip ─────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: activeColor, borderColor: activeColor }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipLabel, { color: active ? '#fff' : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const isCredit = tx.amount > 0;
  const formatted = formatAmount(Math.abs(tx.amount), tx.currency);
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(tx.date);
  const currency = getCurrency(tx.currency);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.txRow, pressed && styles.txRowPressed]}
    >
      <View style={styles.txAvatar}>
        <Text style={styles.txAvatarText}>{tx.recipientName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.txMiddle}>
        <Text style={styles.txName}>{tx.recipientName}</Text>
        <View style={styles.txMeta}>
          <StatusChip status={tx.status} />
          <Text style={styles.txDate}>{date}</Text>
          <Text style={styles.txCurrencyFlag}>{currency.flag}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isCredit ? colors.success : colors.textPrimary }]}>
        {isCredit ? '+' : '−'}{formatted}
      </Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UnifiedActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { wallets, transactions } = useWalletStore();
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const listRef = useRef<SectionListType<Transaction>>(null);
  const scrollReset = useTabScrollReset();

  const filteredTxs = useMemo(() => {
    let base = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());
    if (selectedWalletId) base = base.filter((t) => t.walletId === selectedWalletId);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (t) =>
        t.recipientName.toLowerCase().includes(q) ||
        t.currency.toLowerCase().includes(q) ||
        t.note?.toLowerCase().includes(q),
    );
  }, [transactions, selectedWalletId, query]);

  const sections = useMemo(() => groupByMonth(filteredTxs), [filteredTxs]);

  useEffect(() => {
    if (scrollReset > 0 && sections?.length > 0) {
      listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewOffset: 0 });
    }
  }, [scrollReset, sections]);

  const handleChipPress = (walletId: string | null) => {
    Haptics.selectionAsync();
    setSelectedWalletId(walletId);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      {/* ── Filter chips ────────────────────────────────────────────────── */}
      <View style={styles.chipsRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContent}
      >
        <FilterChip
          label="All"
          active={selectedWalletId === null}
          activeColor={colors.brand}
          onPress={() => handleChipPress(null)}
        />
        {wallets.map((wallet) => {
          const currency = getCurrency(wallet.currency);
          return (
            <FilterChip
              key={wallet.id}
              label={`${currency.flag} ${wallet.currency}`}
              active={selectedWalletId === wallet.id}
              activeColor={walletAccent(wallet.currency)}
              onPress={() => handleChipPress(wallet.id)}
            />
          );
        })}
      </ScrollView>
      </View>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Search size={16} color={colors.textMuted} strokeWidth={1.8} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search all transactions…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Transaction list ────────────────────────────────────────────── */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No transactions found</Text>
          <Text style={styles.emptySub}>Try a different name or keyword.</Text>
        </View>
      ) : (
        <SectionList
          ref={listRef}
          style={styles.list}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionRow
              tx={item}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('TransactionDetail', { txId: item.id });
              }}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },

  // ── Filter chips ──
  chipsRow: {
    flexShrink: 0,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  chipsContent: {
    paddingHorizontal: H_PAD,
    gap: 8,
  },
  chip: {
    height: 34,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    lineHeight: 18,
    includeFontPadding: false,
  },

  // ── Search ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: H_PAD,
    marginBottom: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.base,
    color: colors.textPrimary,
    height: '100%',
  },

  // ── List ──
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },

  sectionHeader: {
    paddingHorizontal: H_PAD,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: H_PAD,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  txRowPressed: {
    backgroundColor: colors.surface,
  },
  txAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txAvatarText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
  txMiddle: { flex: 1 },
  txName: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    marginBottom: 3,
  },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  txDate: { fontSize: typography.xs, color: colors.textMuted },
  txCurrencyFlag: { fontSize: 11, lineHeight: 14 },
  txAmount: { fontSize: typography.base, fontWeight: typography.semibold },

  // ── Empty ──
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: H_PAD,
  },
  emptyTitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  emptySub: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
