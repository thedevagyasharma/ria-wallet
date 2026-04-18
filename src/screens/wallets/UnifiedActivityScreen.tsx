import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  LinearTransition,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronDown, CreditCard, Check, X, type LucideIcon } from 'lucide-react-native';
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
import SecondaryButton from '../../components/SecondaryButton';
import EmptyState from '../../components/EmptyState';
import { CATEGORY_META } from '../../utils/cardCategories';
import type { Card, CardCategory, Transaction, TransactionStatus, TransactionType, Wallet } from '../../stores/types';
import { useTabScrollReset } from '../../navigation/TabScrollContext';
import type { RootStackParamList } from '../../navigation/types';

const H_PAD = 24;

const WALLET_ACCENTS: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};
function walletAccent(c: string) { return WALLET_ACCENTS[c] ?? colors.brand; }

// Orange brand bg pairs with dark brown text; non-brand (wallet/semantic)
// accents stay white — keeps the existing "brand = #441306" rule in one place.
function textOn(color: string): string {
  return color === colors.brand ? '#441306' : '#fff';
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

// ─── Option tables ────────────────────────────────────────────────────────────

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'Last 7 days' },
  { key: 'month',   label: 'This month' },
  { key: '3months', label: 'Last 3 months' },
  { key: 'year',    label: 'This year' },
];

const DIRECTION_OPTIONS: { key: TransactionType; label: string; icon?: LucideIcon }[] = [
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

function toggleInSet<T>(s: Set<T>, v: T): Set<T> {
  const next = new Set(s);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

function dateLabel(p: DatePreset): string {
  return DATE_PRESETS.find((x) => x.key === p)?.label ?? '';
}
function statusLabel(s: TransactionStatus): string {
  return STATUS_OPTIONS.find((x) => x.key === s)?.label ?? '';
}

// ─── Filter chip (row-level) ──────────────────────────────────────────────────

const COLOR_DURATION = 180;

function FilterChip({
  label,
  flagCode,
  icon: Icon,
  active,
  activeColor,
  disabled = false,
  showChevron = true,
  entering,
  exiting,
  onPress,
}: {
  label: string;
  flagCode?: string;
  icon?: LucideIcon;
  active: boolean;
  activeColor: string;
  disabled?: boolean;
  showChevron?: boolean;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
  exiting?: React.ComponentProps<typeof Animated.View>['exiting'];
  onPress: () => void;
}) {
  const lastActiveColor = useRef(activeColor);
  if (active) lastActiveColor.current = activeColor;
  const resolvedColor = active ? activeColor : lastActiveColor.current;
  const resolvedTextColor = textOn(resolvedColor);

  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: COLOR_DURATION });
  }, [active, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, resolvedColor]),
    borderColor:     interpolateColor(progress.value, [0, 1], [colors.border,  resolvedColor]),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, resolvedTextColor]),
  }));

  const iconColor = active ? resolvedTextColor : colors.textMuted;

  return (
    <Animated.View layout={LinearTransition.duration(240)} entering={entering} exiting={exiting}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
        disabled={disabled}
        style={({ pressed }) => [
          disabled && styles.chipDisabled,
          pressed && !disabled && { opacity: 0.7 },
        ]}
      >
        <Animated.View style={[styles.chip, containerStyle]} layout={LinearTransition.duration(240)}>
          {flagCode && <FlagIcon code={flagCode} size={14} />}
          {Icon && <Icon size={14} color={active ? resolvedTextColor : colors.textSecondary} strokeWidth={2} />}
          <Animated.Text style={[styles.chipLabel, textStyle]}>{label}</Animated.Text>
          {showChevron && (
            <ChevronDown size={14} color={iconColor} strokeWidth={2} style={styles.chipChevron} />
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Sheet option chip ────────────────────────────────────────────────────────

function OptionChip({
  label,
  icon: Icon,
  flagCode,
  active,
  activeColor = colors.brand,
  disabled = false,
  onPress,
}: {
  label: string;
  icon?: LucideIcon;
  flagCode?: string;
  active: boolean;
  activeColor?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const activeTextColor = textOn(activeColor);

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
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      disabled={disabled}
      style={({ pressed }) => [
        disabled && styles.optionChipDisabled,
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      <Animated.View style={[styles.optionChip, containerStyle]} layout={LinearTransition.duration(240)}>
        {flagCode && <FlagIcon code={flagCode} size={14} />}
        {Icon && <Icon size={14} color={iconColor} strokeWidth={2} />}
        <Animated.Text style={[styles.optionChipLabel, textStyle]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Picker sheet shell ───────────────────────────────────────────────────────
// Shared shell used by every filter picker: BottomSheet + header with optional
// Reset link + body (flex-wrap chip area) + Apply. Each picker owns its draft
// state and calls onApply to commit, so the list behind the sheet doesn't
// re-filter while the user is toggling.

function PickerSheet({
  visible,
  onClose,
  title,
  canReset,
  onReset,
  onApply,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  canReset: boolean;
  onReset: () => void;
  onApply: () => void;
  children: React.ReactNode;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} swipeToDismiss>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>{title}</Text>
        {canReset && (
          <Pressable onPress={onReset} hitSlop={12}>
            <Text style={styles.filterReset}>Reset</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.pickerBody}>{children}</View>
      <View style={styles.filterDone}>
        <SecondaryButton label="Apply filters" onPress={onApply} style={styles.applyBtn} />
      </View>
    </BottomSheet>
  );
}

// ─── Wallet picker ────────────────────────────────────────────────────────────

function WalletPicker({
  visible,
  onClose,
  wallets,
  initial,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  wallets: Wallet[];
  initial: string | null;
  onApply: (next: string | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleReset = () => {
    Haptics.selectionAsync();
    setDraft(null);
    onApply(null);
  };
  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <PickerSheet
      visible={visible}
      onClose={onClose}
      title="Wallet"
      canReset={draft !== null}
      onReset={handleReset}
      onApply={handleApply}
    >
      {wallets.map((w) => {
        const currency = getCurrency(w.currency);
        const accent = w.accentColor ?? walletAccent(w.currency);
        return (
          <OptionChip
            key={w.id}
            label={w.nickname ?? w.currency}
            flagCode={currency.flag}
            active={draft === w.id}
            activeColor={accent}
            onPress={() => {
              Haptics.selectionAsync();
              setDraft(draft === w.id ? null : w.id);
            }}
          />
        );
      })}
    </PickerSheet>
  );
}

// ─── Type picker ──────────────────────────────────────────────────────────────

function TypePicker({
  visible,
  onClose,
  initial,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  initial: TransactionType | 'all';
  onApply: (next: TransactionType | 'all') => void;
}) {
  const [draft, setDraft] = useState<TransactionType | 'all'>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleReset = () => {
    Haptics.selectionAsync();
    setDraft('all');
    onApply('all');
  };
  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <PickerSheet
      visible={visible}
      onClose={onClose}
      title="Type"
      canReset={draft !== 'all'}
      onReset={handleReset}
      onApply={handleApply}
    >
      {DIRECTION_OPTIONS.map(({ key, label, icon }) => (
        <OptionChip
          key={key}
          label={label}
          icon={icon}
          active={draft === key}
          onPress={() => {
            Haptics.selectionAsync();
            setDraft(draft === key ? 'all' : key);
          }}
        />
      ))}
    </PickerSheet>
  );
}

// ─── Date picker ──────────────────────────────────────────────────────────────

function DatePicker({
  visible,
  onClose,
  initial,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  initial: DatePreset | null;
  onApply: (next: DatePreset | null) => void;
}) {
  const [draft, setDraft] = useState<DatePreset | null>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleReset = () => {
    Haptics.selectionAsync();
    setDraft(null);
    onApply(null);
  };
  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <PickerSheet
      visible={visible}
      onClose={onClose}
      title="Date range"
      canReset={draft !== null}
      onReset={handleReset}
      onApply={handleApply}
    >
      {DATE_PRESETS.map(({ key, label }) => (
        <OptionChip
          key={key}
          label={label}
          active={draft === key}
          onPress={() => {
            Haptics.selectionAsync();
            setDraft(draft === key ? null : key);
          }}
        />
      ))}
    </PickerSheet>
  );
}

// ─── Status picker ────────────────────────────────────────────────────────────

function StatusPicker({
  visible,
  onClose,
  initial,
  direction,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  initial: Set<TransactionStatus>;
  direction: TransactionType | 'all';
  onApply: (next: Set<TransactionStatus>) => void;
}) {
  const [draft, setDraft] = useState<Set<TransactionStatus>>(initial);

  useEffect(() => {
    if (visible) setDraft(new Set(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleReset = () => {
    Haptics.selectionAsync();
    setDraft(new Set());
    onApply(new Set());
  };
  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <PickerSheet
      visible={visible}
      onClose={onClose}
      title="Status"
      canReset={draft.size > 0}
      onReset={handleReset}
      onApply={handleApply}
    >
      {STATUS_OPTIONS.map(({ key, label }) => (
        <OptionChip
          key={key}
          label={label}
          active={draft.has(key)}
          disabled={direction === 'receive'}
          onPress={() => {
            Haptics.selectionAsync();
            setDraft((curr) => toggleInSet(curr, key));
          }}
        />
      ))}
    </PickerSheet>
  );
}

// ─── Category picker ──────────────────────────────────────────────────────────

function CategoryPicker({
  visible,
  onClose,
  initial,
  direction,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  initial: Set<CardCategory>;
  direction: TransactionType | 'all';
  onApply: (next: Set<CardCategory>) => void;
}) {
  const [draft, setDraft] = useState<Set<CardCategory>>(initial);

  useEffect(() => {
    if (visible) setDraft(new Set(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleReset = () => {
    Haptics.selectionAsync();
    setDraft(new Set());
    onApply(new Set());
  };
  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <PickerSheet
      visible={visible}
      onClose={onClose}
      title="Category"
      canReset={draft.size > 0}
      onReset={handleReset}
      onApply={handleApply}
    >
      {CATEGORIES.map((c) => {
        const meta = CATEGORY_META[c];
        return (
          <OptionChip
            key={c}
            label={meta.label}
            icon={meta.Icon as LucideIcon}
            active={draft.has(c)}
            disabled={direction === 'receive'}
            onPress={() => {
              Haptics.selectionAsync();
              setDraft((curr) => toggleInSet(curr, c));
            }}
          />
        );
      })}
    </PickerSheet>
  );
}

// ─── Card picker sheet ────────────────────────────────────────────────────────
// Row-based (not chip-based) because cards carry a name + last4 + color, and
// a long list would spill awkwardly as wrapping chips.

function CardPicker({
  visible,
  onClose,
  cards,
  accent,
  initial,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  cards: Card[];
  accent: string;
  initial: Set<string>;
  onApply: (next: Set<string>) => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(initial);

  useEffect(() => {
    if (visible) setDraft(new Set(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setDraft((curr) => toggleInSet(curr, id));
  };
  const handleReset = () => {
    Haptics.selectionAsync();
    setDraft(new Set());
    onApply(new Set());
  };
  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} swipeToDismiss>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filter by card</Text>
        {draft.size > 0 && (
          <Pressable onPress={handleReset} hitSlop={12}>
            <Text style={styles.filterReset}>Reset</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.cardList}>
        {cards.map((card) => {
          const selected = draft.has(card.id);
          return (
            <Pressable
              key={card.id}
              onPress={() => toggle(card.id)}
              style={({ pressed }) => [styles.cardRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.cardRowSwatch, { backgroundColor: card.color }]}>
                <CreditCard size={16} color="#fff" strokeWidth={2} />
              </View>
              <View style={styles.cardRowText}>
                <Text style={styles.cardRowName} numberOfLines={1}>{card.name}</Text>
                <Text style={styles.cardRowLast4}>·· {card.last4}</Text>
              </View>
              {selected && <Check size={20} color={accent} strokeWidth={2.5} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filterDone}>
        <SecondaryButton label="Apply filters" onPress={handleApply} style={styles.applyBtn} />
      </View>
    </BottomSheet>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UnifiedActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Activity'>>();
  const { wallets, transactions } = useWalletStore();
  const cards = useCardStore((s) => s.cards);

  // When navigated from a specific wallet (stack route), lock to that wallet
  // and hide the wallet chip.
  const scopedWalletId = route.params?.walletId;
  const isScoped = !!scopedWalletId;
  const scopedWallet = useMemo(
    () => (scopedWalletId ? wallets.find((w) => w.id === scopedWalletId) : undefined),
    [wallets, scopedWalletId],
  );

  // Filter state
  const [selectedWalletId, setSelectedWalletId]     = useState<string | null>(null);
  const [datePreset, setDatePreset]                 = useState<DatePreset | null>(null);
  const [direction, setDirection]                   = useState<TransactionType | 'all'>('all');
  const [selectedStatuses, setSelectedStatuses]     = useState<Set<TransactionStatus>>(() => new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<CardCategory>>(() => new Set());
  const [selectedCardIds, setSelectedCardIds]       = useState<Set<string>>(() => new Set());

  // Picker visibility
  const [walletPickerVisible, setWalletPickerVisible]     = useState(false);
  const [typePickerVisible, setTypePickerVisible]         = useState(false);
  const [datePickerVisible, setDatePickerVisible]         = useState(false);
  const [statusPickerVisible, setStatusPickerVisible]     = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [cardPickerVisible, setCardPickerVisible]         = useState(false);

  // Search
  const [query, setQuery] = useState('');

  // Active wallet (scoped pin or user pick)
  const activeWalletId = scopedWalletId ?? selectedWalletId;
  const activeWallet = useMemo(
    () => (activeWalletId ? wallets.find((w) => w.id === activeWalletId) : undefined),
    [activeWalletId, wallets],
  );
  const availableCards = useMemo(
    () => (activeWalletId ? cards.filter((c) => c.walletId === activeWalletId) : []),
    [cards, activeWalletId],
  );

  // Accent used to tint wallet & card chips when active.
  const activeWalletAccent = useMemo(() => {
    if (!activeWallet) return colors.brand;
    return activeWallet.accentColor ?? walletAccent(activeWallet.currency);
  }, [activeWallet]);

  // Drop any selected cards that no longer belong to the active wallet scope.
  useEffect(() => {
    if (selectedCardIds.size === 0) return;
    const allowed = new Set(availableCards.map((c) => c.id));
    const pruned = new Set<string>();
    for (const id of selectedCardIds) if (allowed.has(id)) pruned.add(id);
    if (pruned.size !== selectedCardIds.size) setSelectedCardIds(pruned);
  }, [availableCards, selectedCardIds]);

  const listRef = useRef<SectionListType<Transaction>>(null);
  const scrollReset = useTabScrollReset();

  const filteredTxs = useMemo(() => {
    let base = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());
    const walletIdFilter = scopedWalletId ?? selectedWalletId;
    if (walletIdFilter) base = base.filter((t) => t.walletId === walletIdFilter);
    if (datePreset) {
      const from = datePresetFrom(datePreset);
      base = base.filter((t) => t.date >= from);
    }
    if (direction !== 'all') base = base.filter((t) => t.type === direction);
    if (selectedCardIds.size > 0) {
      base = base.filter((t) => t.cardId && selectedCardIds.has(t.cardId));
    }
    if (selectedStatuses.size > 0) {
      base = base.filter((t) => selectedStatuses.has(t.status));
    }
    if (selectedCategories.size > 0) {
      base = base.filter((t) => t.category != null && selectedCategories.has(t.category));
    }
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

  // ── Chip labels ──────────────────────────────────────────────────────────

  const walletChipLabel = useMemo(() => {
    if (!selectedWalletId) return 'Wallet';
    const w = wallets.find((x) => x.id === selectedWalletId);
    return w?.nickname ?? w?.currency ?? 'Wallet';
  }, [selectedWalletId, wallets]);

  const walletChipFlag = useMemo(() => {
    if (!selectedWalletId) return undefined;
    const w = wallets.find((x) => x.id === selectedWalletId);
    return w ? getCurrency(w.currency).flag : undefined;
  }, [selectedWalletId, wallets]);

  const typeChipLabel = direction === 'all'
    ? 'Type'
    : direction === 'send' ? 'Sent' : 'Received';

  const dateChipLabel = datePreset === null ? 'Date' : dateLabel(datePreset);

  const statusChipLabel = useMemo(() => {
    if (selectedStatuses.size === 0) return 'Status';
    if (selectedStatuses.size === 1) {
      return statusLabel(Array.from(selectedStatuses)[0]);
    }
    return `${selectedStatuses.size} statuses`;
  }, [selectedStatuses]);

  const categoryChipLabel = useMemo(() => {
    if (selectedCategories.size === 0) return 'Category';
    if (selectedCategories.size === 1) {
      return CATEGORY_META[Array.from(selectedCategories)[0]].label;
    }
    return `${selectedCategories.size} categories`;
  }, [selectedCategories]);

  const cardChipLabel = useMemo(() => {
    if (selectedCardIds.size === 0) return 'Cards';
    if (selectedCardIds.size === 1) {
      const only = availableCards.find((c) => selectedCardIds.has(c.id));
      return only ? only.name : '1 card';
    }
    return `${selectedCardIds.size} cards`;
  }, [selectedCardIds, availableCards]);

  // Any user-set filter active? (Scoped wallet pin isn't user-set, so ignore.)
  const hasAnyFilter =
    (!isScoped && selectedWalletId !== null) ||
    direction !== 'all' ||
    datePreset !== null ||
    selectedStatuses.size > 0 ||
    selectedCategories.size > 0 ||
    selectedCardIds.size > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleApplyWallet = (walletId: string | null) => {
    Haptics.selectionAsync();
    setSelectedWalletId(walletId);
  };

  const handleApplyType = (next: TransactionType | 'all') => {
    Haptics.selectionAsync();
    setDirection(next);
    // Received tx are always completed and never carry a category — prune
    // any stranded filters on the switch so results never collapse to 0.
    if (next === 'receive') {
      setSelectedStatuses(new Set());
      setSelectedCategories(new Set());
    }
  };

  const handleApplyDate = (next: DatePreset | null) => {
    Haptics.selectionAsync();
    setDatePreset(next);
  };

  const handleApplyStatus = (next: Set<TransactionStatus>) => {
    Haptics.selectionAsync();
    setSelectedStatuses(next);
  };

  const handleApplyCategory = (next: Set<CardCategory>) => {
    Haptics.selectionAsync();
    setSelectedCategories(next);
  };

  const handleApplyCards = (next: Set<string>) => {
    Haptics.selectionAsync();
    setSelectedCardIds(next);
  };

  const handleClearAll = () => {
    Haptics.selectionAsync();
    if (!isScoped) setSelectedWalletId(null);
    setDirection('all');
    setDatePreset(null);
    setSelectedStatuses(new Set());
    setSelectedCategories(new Set());
    setSelectedCardIds(new Set());
  };

  // ── Empty state copy ─────────────────────────────────────────────────────

  const isFiltered = query.trim().length > 0 || hasAnyFilter;
  const emptyTitle = query.trim() ? 'No transactions found' : isFiltered ? 'No transactions match' : 'No activity yet';
  const emptySub   = query.trim()
    ? 'Try a different name or keyword.'
    : hasAnyFilter
      ? 'Try adjusting your filters.'
      : 'Transactions will appear here once you send or receive money.';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {isScoped ? (
        <View style={styles.headerScoped}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
            <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <View style={styles.navTitleWrap}>
            {scopedWallet && (
              <FlagIcon code={getCurrency(scopedWallet.currency).flag} size={16} />
            )}
            <Text style={styles.navTitle} numberOfLines={1}>
              {scopedWallet?.nickname ?? scopedWallet?.currency ?? ''} activity
            </Text>
          </View>
          <View style={styles.backBtn} />
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Activity</Text>
        </View>
      )}

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color={colors.textMuted} strokeWidth={1.8} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions…"
            placeholderTextColor={colors.textMuted}
            keyboardAppearance="light"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── Filter chip row ─────────────────────────────────────────────── */}
      <Animated.View style={styles.chipsRow} layout={LinearTransition.duration(240)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {!isScoped && (
            <FilterChip
              label={walletChipLabel}
              flagCode={walletChipFlag}
              active={selectedWalletId !== null}
              activeColor={activeWalletAccent}
              onPress={() => { Haptics.selectionAsync(); setWalletPickerVisible(true); }}
            />
          )}
          {activeWalletId && availableCards.length > 0 && (
            <FilterChip
              label={cardChipLabel}
              icon={CreditCard}
              active={selectedCardIds.size > 0}
              activeColor={activeWalletAccent}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(160)}
              onPress={() => { Haptics.selectionAsync(); setCardPickerVisible(true); }}
            />
          )}
          <FilterChip
            label={typeChipLabel}
            active={direction !== 'all'}
            activeColor={colors.brand}
            onPress={() => { Haptics.selectionAsync(); setTypePickerVisible(true); }}
          />
          <FilterChip
            label={dateChipLabel}
            active={datePreset !== null}
            activeColor={colors.brand}
            onPress={() => { Haptics.selectionAsync(); setDatePickerVisible(true); }}
          />
          <FilterChip
            label={statusChipLabel}
            active={selectedStatuses.size > 0}
            activeColor={colors.brand}
            disabled={direction === 'receive'}
            onPress={() => { Haptics.selectionAsync(); setStatusPickerVisible(true); }}
          />
          <FilterChip
            label={categoryChipLabel}
            active={selectedCategories.size > 0}
            activeColor={colors.brand}
            disabled={direction === 'receive'}
            onPress={() => { Haptics.selectionAsync(); setCategoryPickerVisible(true); }}
          />
          {hasAnyFilter && (
            <FilterChip
              label="Clear"
              icon={X}
              active={false}
              activeColor={colors.brand}
              showChevron={false}
              onPress={handleClearAll}
            />
          )}
        </ScrollView>
      </Animated.View>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <Animated.View style={styles.list} layout={LinearTransition.duration(240)}>
        {sections.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            subtitle={emptySub}
            imageSource={isFiltered ? undefined : require('../../../assets/No Transactions.png')}
          />
        ) : (
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => (
              <ActivityItem
                tx={item}
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

      {/* ── Pickers ────────────────────────────────────────────────────── */}
      <WalletPicker
        visible={walletPickerVisible}
        onClose={() => setWalletPickerVisible(false)}
        wallets={wallets}
        initial={selectedWalletId}
        onApply={handleApplyWallet}
      />
      <TypePicker
        visible={typePickerVisible}
        onClose={() => setTypePickerVisible(false)}
        initial={direction}
        onApply={handleApplyType}
      />
      <DatePicker
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        initial={datePreset}
        onApply={handleApplyDate}
      />
      <StatusPicker
        visible={statusPickerVisible}
        onClose={() => setStatusPickerVisible(false)}
        initial={selectedStatuses}
        direction={direction}
        onApply={handleApplyStatus}
      />
      <CategoryPicker
        visible={categoryPickerVisible}
        onClose={() => setCategoryPickerVisible(false)}
        initial={selectedCategories}
        direction={direction}
        onApply={handleApplyCategory}
      />
      <CardPicker
        visible={cardPickerVisible}
        onClose={() => setCardPickerVisible(false)}
        cards={availableCards}
        accent={activeWalletAccent}
        initial={selectedCardIds}
        onApply={handleApplyCards}
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
  navTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navTitle: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },

  // ── Filter chips row ──
  chipsRow: {
    flexShrink: 0,
    paddingVertical: 10,
  },
  chipsContent: {
    paddingHorizontal: H_PAD,
    gap: 8,
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
    overflow: 'hidden',
  },
  chipLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    lineHeight: 18,
    includeFontPadding: false,
  },
  chipChevron: {
    marginLeft: -2,
    marginRight: -2,
  },
  chipDisabled: { opacity: 0.4 },

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
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
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
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },



  // ── Picker sheet (shared) ──
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
  pickerBody: {
    width: '100%',
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
  optionChipDisabled: {
    opacity: 0.4,
  },
  filterDone: {
    width: '100%',
    marginTop: spacing.md,
  },
  applyBtn: {
    width: '100%',
    paddingVertical: spacing.lg,
  },

  // ── Card picker ──
  cardList: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  cardRowSwatch: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRowText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  cardRowName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  cardRowLast4: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
});
