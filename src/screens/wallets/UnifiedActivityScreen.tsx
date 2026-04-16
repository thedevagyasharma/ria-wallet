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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ChevronLeft, CreditCard, X, type LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import { getCurrency } from '../../data/currencies';
import ActivityItem from '../../components/ActivityItem';
import FlagIcon from '../../components/FlagIcon';
import BottomSheet from '../../components/BottomSheet';
import FlatButton from '../../components/FlatButton';
import { CATEGORY_META } from '../../utils/cardCategories';
import type { CardCategory, Transaction, TransactionStatus, TransactionType } from '../../stores/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';
import type { RootStackParamList } from '../../navigation/types';

const H_PAD = 24;

const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};
function walletAccent(c: string) { return WALLET_ACCENTS[c] ?? colors.brand; }

function groupByMonth(txs: Transaction[]): { title: string; data: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(tx.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePreset = 'today' | 'week' | 'month' | '3months' | 'year';

function datePresetFrom(preset: DatePreset): Date {
  const now = new Date();
  switch (preset) {
    case 'today':   return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':    return new Date(now.getTime() - 7 * 86400_000);
    case 'month':   return new Date(now.getFullYear(), now.getMonth(), 1);
    case '3months': return new Date(now.getTime() - 90 * 86400_000);
    case 'year':    return new Date(now.getFullYear(), 0, 1);
  }
}

// ─── Filter chip ─────────────────────────────────────────────────────────────

const COLOR_DURATION = 180;

function FilterChip({
  label,
  flagCode,
  icon: Icon,
  active,
  activeColor,
  activeTextColor = '#fff',
  onPress,
}: {
  label: string;
  flagCode?: string;
  icon?: LucideIcon;
  active: boolean;
  activeColor: string;
  activeTextColor?: string;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: COLOR_DURATION });
  }, [active, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, activeColor]),
    borderColor:     interpolateColor(progress.value, [0, 1], [colors.border,  activeColor]),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, activeTextColor]),
  }));

  // Icon color snaps (lucide Icons don't take animated props cleanly). The
  // container/text fade masks this — icons are small relative to the chip.
  const iconColor = active ? activeTextColor : colors.textSecondary;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Animated.View style={[styles.chip, containerStyle]}>
        {flagCode && <FlagIcon code={flagCode} size={14} />}
        {Icon && <Icon size={14} color={iconColor} strokeWidth={2} />}
        <Animated.Text style={[styles.chipLabel, textStyle]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Sheet option chip ────────────────────────────────────────────────────────

function OptionChip({
  label,
  icon: Icon,
  active,
  activeColor = colors.brand,
  onPress,
}: {
  label: string;
  icon?: LucideIcon;
  active: boolean;
  activeColor?: string;
  onPress: () => void;
}) {
  // Orange brand color pairs with dark brown text, not white
  const activeTextColor = activeColor === colors.brand ? '#441306' : '#fff';

  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: COLOR_DURATION });
  }, [active, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, activeColor]),
    borderColor:     interpolateColor(progress.value, [0, 1], [colors.border,  activeColor]),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, activeTextColor]),
  }));

  const iconColor = active ? activeTextColor : colors.textSecondary;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Animated.View style={[styles.optionChip, containerStyle]}>
        {Icon && <Icon size={14} color={iconColor} strokeWidth={2} />}
        <Animated.Text style={[styles.optionChipLabel, textStyle]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Filter sheet ─────────────────────────────────────────────────────────────

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'Last 7 days' },
  { key: 'month',   label: 'This month' },
  { key: '3months', label: 'Last 3 months' },
  { key: 'year',    label: 'This year' },
];

const DIRECTION_OPTIONS: { key: TransactionType | 'all'; label: string; icon?: LucideIcon }[] = [
  { key: 'all',     label: 'All',      icon: ArrowLeftRight },
  { key: 'send',    label: 'Sent',     icon: ArrowUpRight },
  { key: 'receive', label: 'Received', icon: ArrowDownLeft },
];

const STATUS_OPTIONS: { key: TransactionStatus; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending',   label: 'Pending' },
  { key: 'failed',    label: 'Failed' },
];

const CATEGORIES: CardCategory[] = [
  'groceries', 'fuel', 'coffee', 'streaming', 'music', 'shopping',
  'food_delivery', 'delivery', 'software', 'dining', 'travel', 'transport', 'other',
];

// Toggle membership in an immutable Set — used for multi-select filters.
function toggleInSet<T>(s: Set<T>, v: T): Set<T> {
  const next = new Set(s);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

// Label lookups for sheet-scoped filters (used by active pills).
function dateLabel(p: DatePreset): string {
  return DATE_PRESETS.find((x) => x.key === p)?.label ?? '';
}
function directionLabel(d: TransactionType): string {
  return DIRECTION_OPTIONS.find((x) => x.key === d)?.label ?? '';
}
function statusLabel(s: TransactionStatus): string {
  return STATUS_OPTIONS.find((x) => x.key === s)?.label ?? '';
}

const STATUS_COLOR: Record<TransactionStatus, string> = {
  completed: '#16a34a',
  pending:   '#d97706',
  failed:    '#dc2626',
};

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterChipsRow}>{children}</View>
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  datePreset,
  onDatePreset,
  direction,
  onDirection,
  selectedStatuses,
  onToggleStatus,
  selectedCategories,
  onToggleCategory,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  datePreset: DatePreset | null;
  onDatePreset: (p: DatePreset | null) => void;
  direction: TransactionType | 'all';
  onDirection: (d: TransactionType | 'all') => void;
  selectedStatuses: Set<TransactionStatus>;
  onToggleStatus: (s: TransactionStatus) => void;
  selectedCategories: Set<CardCategory>;
  onToggleCategory: (c: CardCategory) => void;
  onReset: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} swipeToDismiss>
      {/* Header */}
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filters</Text>
        <Pressable onPress={onReset} hitSlop={12}>
          <Text style={styles.filterReset}>Reset all</Text>
        </Pressable>
      </View>

      {/* Date range */}
      <FilterSection title="Date range">
        {DATE_PRESETS.map(({ key, label }) => (
          <OptionChip
            key={key}
            label={label}
            active={datePreset === key}
            onPress={() => {
              Haptics.selectionAsync();
              onDatePreset(datePreset === key ? null : key);
            }}
          />
        ))}
      </FilterSection>

      {/* Type */}
      <FilterSection title="Type">
        {DIRECTION_OPTIONS.map(({ key, label, icon }) => (
          <OptionChip
            key={key}
            label={label}
            icon={icon}
            active={direction === key}
            onPress={() => { Haptics.selectionAsync(); onDirection(key); }}
          />
        ))}
      </FilterSection>

      {/* Status */}
      <FilterSection title="Status">
        {STATUS_OPTIONS.map(({ key, label }) => (
          <OptionChip
            key={key}
            label={label}
            active={selectedStatuses.has(key)}
            activeColor={STATUS_COLOR[key]}
            onPress={() => { Haptics.selectionAsync(); onToggleStatus(key); }}
          />
        ))}
      </FilterSection>

      {/* Category */}
      <FilterSection title="Category">
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          return (
            <OptionChip
              key={c}
              label={meta.label}
              icon={meta.Icon as LucideIcon}
              active={selectedCategories.has(c)}
              onPress={() => { Haptics.selectionAsync(); onToggleCategory(c); }}
            />
          );
        })}
      </FilterSection>

      {/* Done */}
      <View style={styles.filterDone}>
        <FlatButton label="Done" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

// ─── Active filter pill ───────────────────────────────────────────────────────

function ActivePill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onClear(); }}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
      hitSlop={6}
    >
      <Text style={styles.pillLabel}>{label}</Text>
      <X size={12} color={colors.brandDark} strokeWidth={2.5} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UnifiedActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Activity'>>();
  const { wallets, transactions } = useWalletStore();
  const cards = useCardStore((s) => s.cards);

  // When navigated from a specific wallet (stack route), lock to that wallet
  // and suppress the wallet selector chips.
  const scopedWalletId = route.params?.walletId;
  const isScoped = !!scopedWalletId;
  const scopedWallet = useMemo(
    () => (scopedWalletId ? wallets.find((w) => w.id === scopedWalletId) : undefined),
    [wallets, scopedWalletId],
  );

  // Wallet chip filter (tab mode only)
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  // Search
  const [query, setQuery] = useState('');

  // Advanced filters
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePreset, setDatePreset]       = useState<DatePreset | null>(null);
  const [direction, setDirection]         = useState<TransactionType | 'all'>('all');
  const [selectedStatuses, setSelectedStatuses]     = useState<Set<TransactionStatus>>(() => new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<CardCategory>>(() => new Set());
  const [selectedCardIds, setSelectedCardIds]       = useState<Set<string>>(() => new Set());

  // Cards available to pick from — only meaningful once a wallet is active.
  const activeWalletId = scopedWalletId ?? selectedWalletId;
  const availableCards = useMemo(
    () => (activeWalletId ? cards.filter((c) => c.walletId === activeWalletId) : []),
    [cards, activeWalletId],
  );

  // The active wallet's accent color — used to tint the card-chip row.
  const activeWalletAccent = useMemo(() => {
    if (!activeWalletId) return colors.brand;
    const w = wallets.find((x) => x.id === activeWalletId);
    return w?.accentColor ?? walletAccent(w?.currency ?? '');
  }, [activeWalletId, wallets]);

  // Drop any selected cards that no longer belong to the active wallet scope.
  useEffect(() => {
    if (selectedCardIds.size === 0) return;
    const allowed = new Set(availableCards.map((c) => c.id));
    const pruned = new Set<string>();
    for (const id of selectedCardIds) if (allowed.has(id)) pruned.add(id);
    if (pruned.size !== selectedCardIds.size) setSelectedCardIds(pruned);
  }, [availableCards, selectedCardIds]);

  // Wallet & card are represented by their own chip rows; the sheet badge
  // only counts sheet-scoped filters (Date / Type / Status / Category).
  const activeFilterCount =
    (datePreset ? 1 : 0) +
    (direction !== 'all' ? 1 : 0) +
    (selectedStatuses.size > 0 ? 1 : 0) +
    (selectedCategories.size > 0 ? 1 : 0);

  const listRef = useRef<SectionListType<Transaction>>(null);
  const scrollReset = useTabScrollReset();

  const filteredTxs = useMemo(() => {
    let base = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Wallet — scoped mode pins to the route wallet; tab mode uses the chip
    const walletIdFilter = scopedWalletId ?? selectedWalletId;
    if (walletIdFilter) base = base.filter((t) => t.walletId === walletIdFilter);

    // Date range
    if (datePreset) {
      const from = datePresetFrom(datePreset);
      base = base.filter((t) => t.date >= from);
    }

    // Direction
    if (direction !== 'all') base = base.filter((t) => t.type === direction);

    // Cards (multi-select — empty set = no filter)
    if (selectedCardIds.size > 0) {
      base = base.filter((t) => t.cardId && selectedCardIds.has(t.cardId));
    }

    // Statuses (multi-select)
    if (selectedStatuses.size > 0) {
      base = base.filter((t) => selectedStatuses.has(t.status));
    }

    // Categories (multi-select — only card tx have categories)
    if (selectedCategories.size > 0) {
      base = base.filter((t) => t.category != null && selectedCategories.has(t.category));
    }

    // Search
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (t) =>
        t.recipientName.toLowerCase().includes(q) ||
        t.currency.toLowerCase().includes(q) ||
        t.note?.toLowerCase().includes(q),
    );
  }, [transactions, scopedWalletId, selectedWalletId, datePreset, direction, selectedStatuses, selectedCategories, selectedCardIds, query]);

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

  const handleReset = () => {
    Haptics.selectionAsync();
    setDatePreset(null);
    setDirection('all');
    setSelectedStatuses(new Set());
    setSelectedCategories(new Set());
  };

  const handleToggleCard = (cardId: string) => {
    Haptics.selectionAsync();
    setSelectedCardIds((s) => toggleInSet(s, cardId));
  };

  const handleToggleStatus = (s: TransactionStatus) =>
    setSelectedStatuses((curr) => toggleInSet(curr, s));

  const handleToggleCategory = (c: CardCategory) =>
    setSelectedCategories((curr) => toggleInSet(curr, c));

  // Empty state copy adapts to active filters
  const emptyTitle = query.trim() ? 'No transactions found' : 'No transactions match';
  const emptySub   = query.trim()
    ? 'Try a different name or keyword.'
    : activeFilterCount > 0
      ? 'Try adjusting your filters.'
      : 'No activity yet.';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {isScoped ? (
        <View style={styles.headerScoped}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
            <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>
            {scopedWallet?.nickname ?? scopedWallet?.currency ?? ''} activity
          </Text>
          <View style={styles.backBtn} />
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Activity</Text>
        </View>
      )}

      {/* ── Search + filter button (top-level so position is stable) ─────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.textMuted} strokeWidth={1.8} />
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

        <Pressable
          onPress={() => { Haptics.selectionAsync(); setFilterVisible(true); }}
          style={({ pressed }) => [
            styles.filterBtn,
            activeFilterCount > 0 && styles.filterBtnActive,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={6}
        >
          <SlidersHorizontal
            size={18}
            color={activeFilterCount > 0 ? '#441306' : colors.textSecondary}
            strokeWidth={1.8}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Active filter pills (sheet-scoped filters only) ──────────────── */}
      {activeFilterCount > 0 && (
        <Animated.View
          style={styles.pillsRow}
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(160)}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContent}
          >
            {datePreset && (
              <ActivePill
                label={dateLabel(datePreset)}
                onClear={() => setDatePreset(null)}
              />
            )}
            {direction !== 'all' && (
              <ActivePill
                label={directionLabel(direction)}
                onClear={() => setDirection('all')}
              />
            )}
            {Array.from(selectedStatuses).map((s) => (
              <ActivePill
                key={`status-${s}`}
                label={statusLabel(s)}
                onClear={() => setSelectedStatuses((curr) => toggleInSet(curr, s))}
              />
            ))}
            {Array.from(selectedCategories).map((c) => (
              <ActivePill
                key={`cat-${c}`}
                label={CATEGORY_META[c].label}
                onClear={() => setSelectedCategories((curr) => toggleInSet(curr, c))}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* ── Wallet filter chips (tab mode only) ─────────────────────────── */}
      {!isScoped && (
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
              activeTextColor="#441306"
              onPress={() => handleChipPress(null)}
            />
            {wallets.map((wallet) => {
              const currency = getCurrency(wallet.currency);
              const label = wallet.nickname ?? wallet.currency;
              const chipColor = wallet.accentColor ?? walletAccent(wallet.currency);
              return (
                <FilterChip
                  key={wallet.id}
                  label={label}
                  flagCode={currency.flag}
                  active={selectedWalletId === wallet.id}
                  activeColor={chipColor}
                  onPress={() => handleChipPress(wallet.id)}
                />
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Card chips (visible when a wallet is active) ─────────────────── */}
      {activeWalletId && availableCards.length > 0 && (
        <Animated.View
          style={styles.subChipsRow}
          entering={FadeInUp.duration(240)}
          exiting={FadeOutUp.duration(180)}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
          >
            {availableCards.map((card, i) => (
              <Animated.View
                key={card.id}
                entering={FadeInUp.duration(220).delay(60 + i * 40)}
                exiting={FadeOut.duration(120)}
              >
                <FilterChip
                  label={`${card.name} ·· ${card.last4}`}
                  icon={CreditCard}
                  active={selectedCardIds.has(card.id)}
                  activeColor={activeWalletAccent}
                  onPress={() => handleToggleCard(card.id)}
                />
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* ── Transaction list (layout transition smooths shifts above) ───── */}
      <Animated.View style={styles.list} layout={LinearTransition.duration(240)}>
        {sections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySub}>{emptySub}</Text>
          </View>
        ) : (
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ActivityItem
                tx={item}
                wallets={wallets}
                onPress={() => navigation.navigate('TransactionDetail', { txId: item.id })}
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
      </Animated.View>

      {/* ── Filter sheet ─────────────────────────────────────────────────── */}
      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        datePreset={datePreset}
        onDatePreset={setDatePreset}
        direction={direction}
        onDirection={setDirection}
        selectedStatuses={selectedStatuses}
        onToggleStatus={handleToggleStatus}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        onReset={handleReset}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: H_PAD,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerScoped: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },
  navTitle: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  // ── Wallet filter chips ──
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
  subChipsRow: {
    flexShrink: 0,
    paddingTop: 2,
    paddingBottom: 10,
  },
  chip: {
    height: 34,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    lineHeight: 18,
    includeFontPadding: false,
  },

  // ── Search row ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: H_PAD,
    marginBottom: 8,
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: colors.brand,
    lineHeight: 12,
    includeFontPadding: false,
  },

  // ── Active filter pills ──
  pillsRow: {
    flexShrink: 0,
    paddingBottom: 8,
  },
  pillsContent: {
    paddingHorizontal: H_PAD,
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: radius.full,
    backgroundColor: colors.brandSubtle,
    borderWidth: 1,
    borderColor: '#fed7aa', // orange-200
  },
  pillLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    color: colors.brandDark,
    lineHeight: 14,
    includeFontPadding: false,
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
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

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

  // ── Filter sheet ──
  filterHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  filterTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  filterReset: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.brand,
  },
  filterSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  filterSectionTitle: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    height: 34,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  optionChipLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    lineHeight: 18,
    includeFontPadding: false,
  },
  filterDone: {
    width: '100%',
    marginTop: spacing.md,
  },
});
