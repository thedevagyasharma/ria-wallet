import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import { CardFront, CARD_WIDTH, CARD_HEIGHT } from '../../components/CardFace';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import type { Card } from '../../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PALETTE = [
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
];

const SWATCH = 52;
const COLS = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddCardColorScreen({ route }: RootStackProps<'AddCardColor'>) {
  const navigation = useNavigation<Nav>();
  const { walletId, cardType, name } = route.params;
  const [selectedColor, setSelectedColor] = useState(PALETTE[0].hex);

  // Build a preview card
  const previewCard: Card = {
    id: 'preview',
    walletId,
    name,
    color: selectedColor,
    last4: '0000',
    network: 'Visa',
    cardholderName: 'YOUR NAME',
    expiry: 'MM/YY',
    cvv: '000',
    fullNumber: '0000 0000 0000 0000',
    frozen: false,
    type: cardType as Card['type'],
  };

  const handleSelect = useCallback((hex: string) => {
    Haptics.selectionAsync();
    setSelectedColor(hex);
  }, []);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AddCardReview', { walletId, cardType, name, color: selectedColor });
  }, [navigation, walletId, cardType, name, selectedColor]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Choose a color</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Live preview */}
        <View style={styles.previewWrap}>
          <CardFront card={previewCard} currency="USD" />
        </View>

        {/* Palette */}
        <Text style={styles.sectionLabel}>Color</Text>
        <View style={styles.palette}>
          {PALETTE.map((p) => (
            <Pressable
              key={p.hex}
              onPress={() => handleSelect(p.hex)}
              style={styles.swatchWrap}
            >
              <View style={[styles.swatch, { backgroundColor: p.hex }, selectedColor === p.hex && styles.swatchSelected]}>
                {selectedColor === p.hex && (
                  <Check size={18} color="#fff" strokeWidth={2.5} />
                )}
              </View>
              <Text style={[styles.swatchLabel, selectedColor === p.hex && styles.swatchLabelActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton onPress={handleContinue} style={styles.continueBtn}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </PrimaryButton>
      </View>
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

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  previewWrap: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
  },

  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.lg,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  swatchWrap: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.lg * (COLS - 1)) / COLS,
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
  swatchSelected: {
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
  continueBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  continueBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
});
