import { StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';

export const H_PAD = 24;

export const sharedStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingVertical: spacing.md,
  },
  navLeft: { zIndex: 1 },
  navRight: { zIndex: 1 },
  navCloseBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center', marginLeft: -6,
  },
  navTitle: {
    position: 'absolute', left: 0, right: 0,
    textAlign: 'center',
    fontSize: typography.md, fontWeight: typography.semibold, color: colors.textPrimary,
  },

  scroll: { paddingTop: spacing.sm },

  section: {
    paddingHorizontal: H_PAD,
    paddingTop: spacing.xl, paddingBottom: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  sectionLast: { paddingBottom: 0, borderBottomWidth: 0 },
  sectionLabel: {
    fontSize: typography.xs, color: colors.textSecondary,
    fontWeight: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.lg,
  },

  refundBanner: {
    backgroundColor: colors.failedSubtle,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.failed + '33',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginHorizontal: H_PAD, marginTop: spacing.xl, marginBottom: 0,
    gap: spacing.xs,
  },
  refundReason: {
    fontSize: typography.base, fontWeight: typography.semibold,
    color: colors.failed, lineHeight: 22,
  },
  refundText: { fontSize: typography.sm, color: colors.failed, lineHeight: 20, opacity: 0.75 },

  helpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  helpBtnText: {
    fontSize: 11, fontWeight: typography.semibold, color: colors.textPrimary,
  },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: typography.base, color: colors.textMuted },
});
