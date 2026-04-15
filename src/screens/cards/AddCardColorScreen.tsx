import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { CardFront } from '../../components/CardFace';
import { useCardStore } from '../../stores/useCardStore';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Card, CardType, CardFinish } from '../../stores/types'; // CardFinish used for RIA_PALETTE finish field

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Curated Ria Edition colors — Metal automatically gets metallic finish
const RIA_PALETTE = [
  { label: 'Classic', hex: '#f97316', finish: 'plastic'  as CardFinish },
  { label: 'Metal',   hex: '#71717a', finish: 'metallic' as CardFinish },
  { label: 'Green',   hex: '#14532d', finish: 'plastic'  as CardFinish },
  { label: 'Black',   hex: '#09090b', finish: 'plastic'  as CardFinish },
];

// Full solid color palette
const SOLID_PALETTE = [
  { label: 'Midnight',  hex: '#1a1f3c' },
  { label: 'Ocean',     hex: '#0f4c75' },
  { label: 'Plum',      hex: '#2c1a38' },
  { label: 'Forest',    hex: '#1c3020' },
  { label: 'Slate',     hex: '#1e293b' },
  { label: 'Crimson',   hex: '#7f1d1d' },
  { label: 'Amber',     hex: '#78350f' },
  { label: 'Onyx',      hex: '#09090b' },
  { label: 'Cobalt',    hex: '#1e3a5f' },
  { label: 'Charcoal',  hex: '#27272a' },
  { label: 'Blaze',     hex: '#f97316' },
];

const SWATCH = 52;
const COLS = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddCardColorScreen({ route }: RootStackProps<'AddCardColor'>) {
  const navigation = useNavigation<Nav>();
  const { walletId, cardType, name } = route.params;
  const { addCard } = useCardStore();

  const [selectedRia, setSelectedRia] = useState(0);        // index into RIA_PALETTE
  const [selectedSolid, setSelectedSolid] = useState<string | null>(null);  // null = Ria active

  const branded = selectedSolid === null;
  const selectedColor = branded ? RIA_PALETTE[selectedRia].hex : selectedSolid!;
  const finish: CardFinish = branded ? RIA_PALETTE[selectedRia].finish : 'plastic';

  const previewCard: Card = {
    id: 'preview',
    walletId,
    name,
    color: selectedColor,
    branded,
    finish,
    last4: '0000',
    network: 'Visa',
    cardholderName: 'YOUR NAME',
    expiry: 'MM/YY',
    cvv: '000',
    fullNumber: '0000 0000 0000 0000',
    frozen: false,
    type: cardType as CardType,
  };

  const handleRiaSelect = useCallback((idx: number) => {
    Haptics.selectionAsync();
    setSelectedRia(idx);
    setSelectedSolid(null);
  }, []);

  const handleSolidSelect = useCallback((hex: string) => {
    Haptics.selectionAsync();
    setSelectedSolid(hex);
  }, []);

  const handleAddCard = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const networks = ['Visa', 'Mastercard'] as const;
    const network = networks[Math.floor(Math.random() * networks.length)];
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const prefix = network === 'Visa' ? '4' : '5';
    const g1 = prefix + Math.random().toString().slice(2, 5);
    const g2 = Math.random().toString().slice(2, 6);
    const g3 = Math.random().toString().slice(2, 6);
    const fullNumber = `${g1} ${g2} ${g3} ${last4}`;
    const month = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
    const year = String(27 + Math.floor(Math.random() * 4));
    const cardId = `card-${Date.now()}`;

    addCard({
      id: cardId,
      walletId,
      name,
      color: selectedColor,
      branded,
      finish,
      last4,
      network,
      cardholderName: 'Carlos Mendez',
      expiry: `${month}/${year}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      fullNumber,
      frozen: false,
      type: cardType as CardType,
    });

    navigation.navigate('AddCardReview', { cardId });
  }, [addCard, navigation, walletId, name, selectedColor, branded, finish, cardType]);

  const btnLabel = cardType === 'physical' ? 'Confirm & pay $4.99' : 'Add card';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Design your card</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Live preview */}
        <View style={styles.previewWrap}>
          <CardFront card={previewCard} currency="USD" />
        </View>

        {/* ── Ria Edition ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Ria Edition</Text>
        </View>
        <View style={styles.riaRow}>
          {RIA_PALETTE.map((p, i) => {
            const active = branded && selectedRia === i;
            return (
              <Pressable key={p.hex} onPress={() => handleRiaSelect(i)} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: p.hex }, active && styles.swatchActive]}>
                  {active && <Check size={16} color="#fff" strokeWidth={2.5} />}
                </View>
                <Text style={[styles.swatchLabel, active && styles.swatchLabelActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Solid Colors ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Color</Text>
        </View>
        <View style={styles.palette}>
          {SOLID_PALETTE.map((p) => {
            const active = !branded && selectedColor === p.hex;
            return (
              <Pressable key={p.hex} onPress={() => handleSolidSelect(p.hex)} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: p.hex }, active && styles.swatchActive]}>
                  {active && <Check size={16} color="#fff" strokeWidth={2.5} />}
                </View>
                <Text style={[styles.swatchLabel, active && styles.swatchLabelActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton onPress={handleAddCard} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{btnLabel}</Text>
        </PrimaryButton>
      </View>
    </SafeAreaView>
  );
}

const SWATCH_W = (SCREEN_WIDTH - spacing.xl * 2 - spacing.lg * (COLS - 1)) / COLS;

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

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  previewWrap: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSub: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },

  // Ria Edition — wrapping grid, same rhythm as solid palette
  riaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },

  // Solid palette grid
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },

  swatchWrap: {
    width: SWATCH_W,
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2.5,
    borderColor: colors.brand,
  },
  swatchLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  swatchLabelActive: {
    color: colors.brand,
    fontWeight: typography.semibold,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  addBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  addBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
});
