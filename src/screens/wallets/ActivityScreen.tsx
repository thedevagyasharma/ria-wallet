import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  SectionList,
  type SectionList as SectionListType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { getCurrency, formatAmount } from '../../data/currencies';
import StatusChip from '../../components/StatusChip';
import type { RootStackParamList } from '../../navigation/types';
import type { Transaction } from '../../stores/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const H_PAD = 24;

function groupByMonth(txs: Transaction[]): { title: string; data: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(tx.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.amount > 0;
  const formatted = formatAmount(Math.abs(tx.amount), tx.currency);
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(tx.date);
  return (
    <View style={styles.txRow}>
      <View style={styles.txAvatar}>
        <Text style={styles.txAvatarText}>{tx.recipientName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.txMiddle}>
        <Text style={styles.txName}>{tx.recipientName}</Text>
        <View style={styles.txMeta}>
          <StatusChip status={tx.status} />
          <Text style={styles.txDate}>{date}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isCredit ? colors.success : colors.textPrimary }]}>
        {isCredit ? '+' : '−'}{formatted}
      </Text>
    </View>
  );
}

export default function ActivityScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { transactions, wallets, activeWalletId } = useWalletStore();
  const walletId = (route.params as { walletId?: string } | undefined)?.walletId ?? activeWalletId;
  const canGoBack = navigation.canGoBack();
  const wallet = wallets.find((w) => w.id === walletId);
  const screenTitle = wallet
    ? `${getCurrency(wallet.currency).flag}  ${wallet.currency} Activity`
    : 'Activity';
  const [query, setQuery] = useState('');
  const listRef = useRef<SectionListType<Transaction>>(null);
  const scrollReset = useTabScrollReset();

  const walletTxs = useMemo(() => {
    const base = transactions
      .filter((t) => t.walletId === walletId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (t) =>
        t.recipientName.toLowerCase().includes(q) ||
        t.currency.toLowerCase().includes(q) ||
        t.note?.toLowerCase().includes(q),
    );
  }, [transactions, walletId, query]);

  const sections = useMemo(() => groupByMonth(walletTxs), [walletTxs]);

  useEffect(() => {
    if (scrollReset > 0 && sections?.length > 0) {
      listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewOffset: 0 });
    }
  }, [scrollReset, sections]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        {canGoBack ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          >
            <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={1.8} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.title}>{screenTitle}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchWrap}>
        <Search size={16} color={colors.textMuted} strokeWidth={1.8} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No transactions found</Text>
          <Text style={styles.emptySub}>Try a different name or keyword.</Text>
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TransactionRow tx={item} />}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: { padding: 2 },
  title: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  headerRight: { width: 26 },

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
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: typography.base,
    color: colors.textPrimary,
    height: '100%',
  },

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
  txAmount: { fontSize: typography.base, fontWeight: typography.semibold },

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
