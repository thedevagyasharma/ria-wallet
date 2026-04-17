import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal, Dimensions, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Vertical gap between direct children. Defaults to 0. */
  gap?: number;
  /** Expand the sheet to fill the full screen height. */
  fullHeight?: boolean;
  /** Allow dragging the handle down to dismiss. */
  swipeToDismiss?: boolean;
};

const SCREEN_H = Dimensions.get('window').height;

export default function BottomSheet({ visible, onClose, children, gap = 0, fullHeight = false, swipeToDismiss = false }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const overlayOpacity = useSharedValue(0);
  const sheetY = useSharedValue(SCREEN_H);
  const dragY = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      dragY.value = 0;
      overlayOpacity.value = 0;
      sheetY.value = SCREEN_H;
      overlayOpacity.value = withTiming(1, { duration: 240 });
      sheetY.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      sheetY.value = withTiming(
        SCREEN_H,
        { duration: 260, easing: Easing.in(Easing.quad) },
        (finished) => { if (finished) runOnJS(setMounted)(false); },
      );
    }
  }, [visible, mounted]);

  const panGesture = useMemo(() => Gesture.Pan()
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (dragY.value > 100 || e.velocityY > 600) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        overlayOpacity.value = withTiming(0, { duration: 200 });
        sheetY.value = withTiming(
          SCREEN_H,
          { duration: 260, easing: Easing.in(Easing.quad) },
          (finished) => {
            if (finished) {
              runOnJS(setMounted)(false);
              runOnJS(onClose)();
            }
          },
        );
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    }), [onClose]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value + dragY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} />
        <Animated.View
          style={[
            styles.sheet,
            gap > 0 && { gap },
            kbHeight > 0 && { paddingBottom: kbHeight },
            fullHeight && styles.sheetFull,
            fullHeight && {
              paddingTop: spacing.xl + insets.top,
              paddingBottom: spacing.xl + insets.bottom,
            },
            sheetStyle,
          ]}
          onStartShouldSetResponder={() => true}
        >
          {swipeToDismiss ? (
            <GestureDetector gesture={panGesture}>
              <View style={styles.handleArea}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
          ) : (
            <View style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
          )}
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  sheetFull: {
    flex: 1,
  },
  handleArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
});
