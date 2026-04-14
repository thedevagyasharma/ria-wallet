import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { colors, typography, spacing, radius } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SUGGESTIONS = [
  'Everyday Spend', 'Online Shopping', 'Subscriptions',
  'Travel', 'Work Expenses', 'Savings',
];

export default function AddCardNameScreen({ route }: RootStackProps<'AddCardName'>) {
  const navigation = useNavigation<Nav>();
  const { walletId, cardType } = route.params;
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canContinue = name.trim().length > 0;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AddCardColor', { walletId, cardType, name: name.trim() });
  }, [canContinue, navigation, walletId, cardType, name]);

  const handleSuggestion = useCallback((s: string) => {
    Haptics.selectionAsync();
    setName(s);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Name your card</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputSection}>
          <Text style={styles.label}>Card name</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Everyday Spend"
            placeholderTextColor={colors.textMuted}
            autoFocus
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          <Text style={styles.hint}>{name.trim().length}/24</Text>
        </View>

        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsLabel}>Suggestions</Text>
          <View style={styles.suggestionsWrap}>
            {SUGGESTIONS.map((s) => (
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

        <View style={styles.footer}>
          <PrimaryButton
            onPress={handleContinue}
            disabled={!canContinue}
            style={styles.continueBtn}
          >
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
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.md, color: colors.textPrimary, fontWeight: typography.semibold },

  body: { flex: 1, paddingHorizontal: spacing.xl },

  inputSection: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  label: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.lg,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  hint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  suggestionsSection: { marginBottom: spacing.xl },
  suggestionsLabel: {
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
  chipActive: {
    backgroundColor: colors.brandSubtle,
    borderColor: colors.brand,
  },
  chipPressed: { opacity: 0.7 },
  chipText: { fontSize: typography.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.brand, fontWeight: typography.semibold },

  footer: { marginTop: 'auto', paddingBottom: spacing.xl },
  continueBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  continueBtnText: { fontSize: typography.md, color: '#441306', fontWeight: typography.bold },
});
