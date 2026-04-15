import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticate } from '../utils/auth';
import * as Haptics from 'expo-haptics';
import { Lock } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../theme';
import { usePrefsStore } from '../stores/usePrefsStore';

type AuthMethod = 'faceId' | 'touchId' | 'passcode';

function label(method: AuthMethod) {
  if (method === 'faceId')    return 'Unlock with Face ID';
  if (method === 'touchId')   return 'Unlock with Touch ID';
  return 'Unlock with Passcode';
}

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const appLockEnabled = usePrefsStore((s) => s.appLockEnabled);

  const [locked,     setLocked]     = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('passcode');
  const [errored,    setErrored]    = useState(false);

  const appStateRef = useRef(AppState.currentState);

  // Mock always presents as Face ID for demo purposes
  useEffect(() => { setAuthMethod('faceId'); }, []);

  // Clear lock if app lock is disabled
  useEffect(() => {
    if (!appLockEnabled) setLocked(false);
  }, [appLockEnabled]);

  // Re-lock whenever app returns from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (appLockEnabled && prev === 'background' && next === 'active') {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [appLockEnabled]);

  const authenticate = useCallback(async () => {
    setErrored(false);

    const result = await authenticate('Unlock Ria Wallet');

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocked(false);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrored(true);
    }
  }, []);

  // Auto-prompt when the lock screen appears
  useEffect(() => {
    if (locked) authenticate();
  }, [locked]);

  return (
    <View style={{ flex: 1 }}>
      {children}

      {appLockEnabled && locked && (
        <View style={StyleSheet.absoluteFill}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.content}>
              {/* Branding */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>CM</Text>
              </View>
              <Text style={styles.name}>Carlos Mendez</Text>

              <View style={styles.lockRow}>
                <Lock size={13} color={colors.textMuted} strokeWidth={2} />
                <Text style={styles.lockLabel}>Session locked</Text>
              </View>

              {/* Error feedback */}
              {errored && (
                <Text style={styles.errorText}>
                  Authentication failed — try again.
                </Text>
              )}

              {/* Unlock button */}
              <Pressable
                onPress={authenticate}
                style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.unlockBtnText}>{label(authMethod)}</Text>
              </Pressable>
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
    gap: spacing.md,
  },

  // ── Avatar ──
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: typography.xl,
    color: '#fff',
    fontWeight: typography.bold,
    letterSpacing: 0.5,
  },
  name: {
    fontSize: typography.lg,
    color: colors.textPrimary,
    fontWeight: typography.bold,
  },

  // ── Lock badge ──
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.xl,
  },
  lockLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },

  // ── Error ──
  errorText: {
    fontSize: typography.sm,
    color: colors.failed,
    marginBottom: spacing.sm,
  },

  // ── Unlock button ──
  unlockBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    minWidth: 220,
    alignItems: 'center',
  },
  unlockBtnText: {
    fontSize: typography.md,
    color: '#fff',
    fontWeight: typography.bold,
  },
});
