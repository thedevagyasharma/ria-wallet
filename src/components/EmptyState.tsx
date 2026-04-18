import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from './PrimaryButton';
import { colors, spacing, typography } from '../theme';

type Action = {
  label: string;
  onPress: () => void;
};

type Props = {
  /** Pre-built illustration node — pass an <Image>, an icon, or any React element. */
  illustration?: React.ReactNode;
  /** Shorthand: pass a require(…) source and we render a standard-sized Image for you. */
  imageSource?: ImageSourcePropType;
  title: string;
  subtitle?: string;
  action?: Action;
  /**
   * Compact mode — for inline empty states inside scroll views.
   * Uses top padding instead of flex centering, and smaller text.
   * No CTA button is rendered in compact mode.
   */
  compact?: boolean;
};

/**
 * Shared empty-state layout.
 *
 * Usage examples:
 *
 *   // With a bundled image asset
 *   <EmptyState
 *     imageSource={require('../../assets/Isometric Cards.png')}
 *     title="No cards yet"
 *     subtitle="Create a card to start spending from this wallet."
 *     action={{ label: 'Create a new card', onPress: handleAddCard }}
 *   />
 *
 *   // With a Lucide icon node
 *   <EmptyState
 *     illustration={<Search size={48} color={colors.textMuted} strokeWidth={1.5} />}
 *     title="No contacts found"
 *     subtitle='Try a different name or keyword.'
 *   />
 */
export default function EmptyState({ illustration, imageSource, title, subtitle, action, compact = false }: Props) {
  const illu = illustration ?? (
    imageSource != null ? (
      <Image source={imageSource} style={compact ? styles.compactImage : styles.image} resizeMode="contain" />
    ) : null
  );

  if (compact) {
    return (
      <View style={styles.compactRoot}>
        {illu != null && <View style={styles.compactIlluWrap}>{illu}</View>}
        <Text style={styles.compactTitle}>{title}</Text>
        {subtitle != null && <Text style={styles.compactSubtitle}>{subtitle}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {illu != null && <View style={styles.illuWrap}>{illu}</View>}
        <Text style={styles.title}>{title}</Text>
        {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {action != null && (
        <PrimaryButton
          label={action.label}
          onPress={action.onPress}
          style={styles.btn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Full-screen layout ──
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  illuWrap: {
    marginBottom: spacing.lg,
  },
  image: {
    width: 280,
    height: 220,
  },
  compactImage: {
    width: 180,
    height: 140,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    paddingVertical: spacing.lg,
  },

  // ── Compact / inline layout ──
  compactIlluWrap: {
    marginBottom: spacing.sm,
  },
  compactRoot: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  compactTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  compactSubtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
