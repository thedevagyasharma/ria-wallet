import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticate as runAuth } from '../utils/auth';
import * as Haptics from 'expo-haptics';
import { Lock, ScanFace, Fingerprint } from 'lucide-react-native';
import PrimaryButton from './PrimaryButton';
import { colors, typography, spacing, radius } from '../theme';
import { usePrefsStore } from '../stores/usePrefsStore';

type AuthMethod = 'faceId' | 'touchId' | 'passcode';

const METHOD_COPY: Record<
  AuthMethod,
  { label: string; verb: string; Icon: typeof ScanFace }
> = {
  faceId:   { label: 'Unlock with Face ID',  verb: 'Face ID',  Icon: ScanFace },
  touchId:  { label: 'Unlock with Touch ID', verb: 'Touch ID', Icon: Fingerprint },
  passcode: { label: 'Unlock with Passcode', verb: 'passcode', Icon: Lock },
};

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const appLockEnabled = usePrefsStore((s) => s.appLockEnabled);

  const [locked,     setLocked]     = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('faceId');
  const [errored,    setErrored]    = useState(false);
  const [busy,       setBusy]       = useState(false);

  const appStateRef       = useRef(AppState.currentState);
  const wentBackgroundRef = useRef(false);

  // Mock always presents as Face ID for demo purposes
  useEffect(() => { setAuthMethod('faceId'); }, []);

  // Clear lock if app lock is disabled
  useEffect(() => {
    if (!appLockEnabled) setLocked(false);
  }, [appLockEnabled]);

  const handleUnlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErrored(false);

    const result = await runAuth('Unlock Ria Wallet');

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocked(false);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrored(true);
    }
    setBusy(false);
  }, [busy]);

  // Keep a stable ref so the AppState effect doesn't re-subscribe on every render
  const handleUnlockRef = useRef(handleUnlock);
  useEffect(() => { handleUnlockRef.current = handleUnlock; });

  // Lock as soon as the app leaves the foreground — covers the iOS App Switcher
  // snapshot AND prevents a one-frame flash of the previous screen on resume.
  // Only the background round-trip prompts biometrics; brief inactive states
  // (notification / control center pull-down) auto-dismiss the overlay.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (!appLockEnabled) return;

      if (next === 'background') wentBackgroundRef.current = true;

      if (prev === 'active' && next !== 'active') {
        setLocked(true);
      }

      if (prev !== 'active' && next === 'active') {
        if (wentBackgroundRef.current) {
          wentBackgroundRef.current = false;
          handleUnlockRef.current();
        } else {
          setLocked(false);
        }
      }
    });
    return () => sub.remove();
  }, [appLockEnabled]);

  const { label, verb, Icon } = METHOD_COPY[authMethod];

  return (
    <View style={{ flex: 1 }}>
      {children}

      {appLockEnabled && locked && (
        <View style={StyleSheet.absoluteFill}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.content}>
              <View style={styles.glyphRing}>
                <View style={styles.glyphInner}>
                  <Icon size={56} color={colors.brand} strokeWidth={1.6} />
                </View>
              </View>

              <Text style={styles.title}>Welcome back, Carlos</Text>
              <Text style={[styles.subtitle, errored && styles.subtitleError]}>
                {errored
                  ? 'Authentication failed — tap below to retry.'
                  : `Use ${verb} to unlock Ria Wallet.`}
              </Text>

              <View style={styles.lockRow}>
                <Lock size={12} color={colors.textMuted} strokeWidth={2} />
                <Text style={styles.lockLabel}>Session locked</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <PrimaryButton
                onPress={handleUnlock}
                disabled={busy}
                style={styles.unlockBtn}
              >
                <View style={styles.btnRow}>
                  <Icon size={18} color="#441306" strokeWidth={2.2} />
                  <Text style={styles.unlockBtnText}>{label}</Text>
                </View>
              </PrimaryButton>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  // ── Hero glyph ──
  glyphRing: {
    width: 132,
    height: 132,
    borderRadius: radius.full,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  glyphInner: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Copy ──
  title: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: typography.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  subtitleError: {
    color: colors.failed,
  },

  // ── Lock badge ──
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },

  // ── Footer CTA ──
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  unlockBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unlockBtnText: {
    fontSize: typography.md,
    color: '#441306',
    fontWeight: typography.bold,
  },
});
