import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, X, Check } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SUGGESTIONS: Record<string, string[]> = {
  USD: ['Main',       'Savings',    'Everyday',   'Business',    'Online Shopping'],
  EUR: ['Europe',     'Travel EU',  'Savings',    'Business EU', 'Online EU'],
  GBP: ['London',     'UK Expenses','Savings',    'Business UK', 'Subscriptions'],
  MXN: ['Mexico',     'Family',     'Rent Mexico','Travel MX',   'Savings'],
  PHP: ['Philippines','Family',     'Manila',     'Remittance',  'Savings'],
  INR: ['India',      'Family',     'Mumbai',     'Remittance',  'Savings'],
};

// Accent palette — same values used in WalletsScreen's WALLET_ACCENTS
const ACCENT_PALETTE = [
  '#2563eb', // cobalt
  '#16a34a', // emerald
  '#9333ea', // purple
  '#d97706', // amber
  '#059669', // teal
  '#4f46e5', // indigo
  '#0284c7', // sky
  '#dc2626', // red
  '#f97316', // blaze / brand orange
  '#ca8a04', // gold
];

// Currency → default accent (mirrors WALLET_ACCENTS in WalletsScreen)
const CURRENCY_ACCENT: Record<string, string> = {
  USD: '#2563eb', MXN: '#16a34a', PHP: '#9333ea', INR: '#d97706',
  NGN: '#059669', GBP: '#4f46e5', EUR: '#0284c7', GTQ: '#0d9488',
  HNL: '#0369a1', DOP: '#dc2626', COP: '#ca8a04', MAD: '#ea580c',
};

const SWATCH = 36;

export default function AddWalletNameScreen({ route }: RootStackProps<'AddWalletName'>) {
  const navigation = useNavigation<Nav>();
  const { currency } = route.params;

  const defaultAccent = CURRENCY_ACCENT[currency] ?? colors.brand;
  const suggestions = SUGGESTIONS[currency] ?? ['Savings', 'Travel', 'Everyday', 'Business'];
  const [name, setName] = useState('');
  const [accentColor, setAccentColor] = useState(defaultAccent);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      inputRef.current?.focus();
    });
    return () => task.cancel();
  }, []);

  const resolvedName = name.trim() || currency;

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WalletReview', { currency, nickname: resolvedName, accentColor });
  }, [navigation, currency, resolvedName, accentColor]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WalletReview', { currency, nickname: currency, accentColor: defaultAccent });
  }, [navigation, currency, defaultAccent]);

  const handleSuggestion = useCallback((s: string) => {
    Haptics.selectionAsync();
    setName(s);
    inputRef.current?.blur();
  }, []);

  const handleClear = useCallback(() => {
    Haptics.selectionAsync();
    setName('');
    inputRef.current?.focus();
  }, []);

  const handleAccent = useCallback((hex: string) => {
    Haptics.selectionAsync();
    setAccentColor(hex);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Name your wallet</Text>
        <Pressable onPress={handleSkip} style={styles.headerBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Wallet name</Text>
            <View style={[styles.inputRow, { borderBottomColor: accentColor }]}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={currency}
                placeholderTextColor={colors.textMuted}
                keyboardAppearance="light"
                maxLength={24}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
              {name.length > 0 && (
                <Pressable onPress={handleClear} style={styles.clearBtn}>
                  <X size={16} color={colors.textMuted} strokeWidth={2.5} />
                </Pressable>
              )}
            </View>
            <Text style={styles.hint}>{name.trim().length}/24</Text>
          </View>

          {/* Suggestions */}
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionLabel}>Suggestions</Text>
            <View style={styles.suggestionsWrap}>
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSuggestion(s)}
                  style={({ pressed }) => [
                    styles.chip,
                    name === s && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.chipText, name === s && styles.chipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Accent color */}
          <View style={styles.accentSection}>
            <Text style={styles.sectionLabel}>Accent color</Text>
            <View style={styles.swatchRow}>
              {ACCENT_PALETTE.map((hex) => {
                const active = accentColor === hex;
                return (
                  <Pressable key={hex} onPress={() => handleAccent(hex)} style={styles.swatchWrap}>
                    <View style={[styles.swatch, { backgroundColor: hex }, active && styles.swatchActive]}>
                      {active && <Check size={14} color="#fff" strokeWidth={2.5} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton onPress={handleContinue} style={styles.continueBtn}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </PrimaryButton>
        </View>
      </KeyboardAvoidingView>
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
  headerBtn: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },
  skipText: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },

  body: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },

  inputSection: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  label: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: spacing.md,
    fontSize: 28,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    letterSpacing: -0.5,
  },
  clearBtn: { padding: spacing.xs, marginLeft: spacing.sm },
  hint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  suggestionsSection: { marginBottom: spacing.xxl },
  accentSection: { marginBottom: spacing.lg },

  sectionLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    marginBottom: spacing.md,
  },

  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.brandSubtle, borderColor: colors.brand },
  chipPressed: { opacity: 0.7 },
  chipText: { fontSize: typography.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.brand, fontWeight: typography.semibold },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatchWrap: { padding: 2 },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2.5,
    borderColor: colors.textPrimary,
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  continueBtn: { paddingVertical: spacing.lg, alignItems: 'center' },
  continueBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
});
