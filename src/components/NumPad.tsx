import React from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Delete } from 'lucide-react-native';
import { colors, typography } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function NumKey({ label, onPress, style }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.88, { duration: 60 }),
      withTiming(1, { duration: 100 }),
    );
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={[styles.key, style]}>
      <Animated.View style={animStyle}>
        {label === '⌫'
          ? <Delete size={22} color={colors.textPrimary} strokeWidth={1.8} />
          : <Text style={styles.keyText}>{label}</Text>}
      </Animated.View>
    </Pressable>
  );
}

// 12-key layouts — empty string renders as a spacer, not a key
export const NUM_KEYS_AMOUNT = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
export const NUM_KEYS_PIN    = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '',  '0', '⌫'];

const styles = StyleSheet.create({
  key: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: typography.xxl,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
});
