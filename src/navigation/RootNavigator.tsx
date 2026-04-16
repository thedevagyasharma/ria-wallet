import React, { useState, useCallback, useEffect } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wallet2, Clock, ArrowUpRight, CreditCard, UserCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackParamList } from './types';
import { TabScrollContext } from './TabScrollContext';
import { colors, typography } from '../theme';
import { useWalletStore } from '../stores/useWalletStore';
import { useTabStore } from '../stores/useTabStore';

// Wallet screens
import WalletsScreen from '../screens/wallets/WalletsScreen';
import CurrencyPickerScreen from '../screens/wallets/CurrencyPickerScreen';
import WalletReviewScreen from '../screens/wallets/WalletReviewScreen';
import WalletSuccessScreen from '../screens/wallets/WalletSuccessScreen';
import WalletSettingsScreen from '../screens/wallets/WalletSettingsScreen';
import UnifiedActivityScreen from '../screens/wallets/UnifiedActivityScreen';
import TransactionDetailScreen from '../screens/activity/TransactionDetailScreen';

// Send screens
import SendMoneyScreen from '../screens/send/SendMoneyScreen';
import SendSuccessScreen from '../screens/send/SendSuccessScreen';
import SendErrorScreen from '../screens/send/SendErrorScreen';

// Card screens
import AllCardsScreen from '../screens/cards/AllCardsScreen';
import WalletCardListScreen from '../screens/cards/WalletCardListScreen';
import CardDetailScreen from '../screens/cards/CardDetailScreen';
import AddCardTypeScreen from '../screens/cards/AddCardTypeScreen';
import AddCardNameScreen from '../screens/cards/AddCardNameScreen';
import AddCardColorScreen from '../screens/cards/AddCardColorScreen';
import AddCardReviewScreen from '../screens/cards/AddCardReviewScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const SCREEN_WIDTH = Dimensions.get('window').width;

// Tab definitions — rendered side-by-side in a Reanimated row
const TABS = [
  { key: 'Wallets',     label: 'Wallets',   Icon: Wallet2,    Screen: WalletsScreen  as React.ComponentType },
  { key: 'Cards',       label: 'Cards',     Icon: CreditCard, Screen: AllCardsScreen as React.ComponentType },
  { key: 'ActivityTab', label: 'Activity',  Icon: Clock,      Screen: UnifiedActivityScreen as React.ComponentType },
  { key: 'Profile',     label: 'Profile',   Icon: UserCircle, Screen: ProfileScreen  as React.ComponentType },
];

function TabItem({ label, Icon, active, onPress }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? colors.brand : colors.textMuted;
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Icon size={22} color={color} strokeWidth={1.8} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

// Branded Send FAB
function SendCTAButton({ onPress }: { onPress?: () => void }) {
  return (
    <View style={styles.sendBtnOverlay} pointerEvents="box-none">
    <Pressable onPress={onPress} style={styles.sendBtn}>
      {({ pressed }) => (
        <>
          <View style={[styles.sendCircle, pressed && styles.sendCirclePressed]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.00)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ArrowUpRight size={24} color="#441306" strokeWidth={2.2} />
          </View>
          <Text style={styles.sendLabel}>Send</Text>
        </>
      )}
    </Pressable>
    </View>
  );
}

function TabNavigator() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeWalletId } = useWalletStore();
  const { activeTabIdx, setActiveTabIdx } = useTabStore();
  const insets = useSafeAreaInsets();
  const [resetCounts, setResetCounts] = useState<Record<string, number>>({});
  const tabX = useSharedValue(-activeTabIdx * SCREEN_WIDTH);

  // Keep the slide animation in sync with the store — covers both taps (which
  // route through goToTab → setActiveTabIdx) and external jumps (e.g.
  // AddCardReview's Done button calling setActiveTabIdx directly).
  useEffect(() => {
    tabX.value = withTiming(-activeTabIdx * SCREEN_WIDTH, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeTabIdx, tabX]);

  const goToTab = useCallback((idx: number) => {
    if (idx === activeTabIdx) {
      const key = TABS[idx].key;
      setResetCounts(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      return;
    }
    setActiveTabIdx(idx);
  }, [activeTabIdx, setActiveTabIdx]);

  const rowStyle = useAnimatedStyle(() => ({
    flex: 1,
    flexDirection: 'row' as const,
    width: SCREEN_WIDTH * TABS.length,
    transform: [{ translateX: tabX.value }],
  }));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={rowStyle}>
          {TABS.map(({ key, Screen }) => (
            <TabScrollContext.Provider key={key} value={resetCounts[key] ?? 0}>
              <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
                <Screen />
              </View>
            </TabScrollContext.Provider>
          ))}
        </Animated.View>
      </View>

      <View>
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TabItem label="Wallets"  Icon={Wallet2}    active={activeTabIdx === 0} onPress={() => goToTab(0)} />
          <TabItem label="Cards"    Icon={CreditCard} active={activeTabIdx === 1} onPress={() => goToTab(1)} />
          <View style={{ flex: 1 }} />
          <TabItem label="Activity" Icon={Clock}       active={activeTabIdx === 2} onPress={() => goToTab(2)} />
          <TabItem label="Profile"  Icon={UserCircle}  active={activeTabIdx === 3} onPress={() => goToTab(3)} />
        </View>
        <SendCTAButton onPress={() => navigation.navigate('SendMoney', { walletId: activeWalletId })} />
      </View>
    </View>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Main" component={TabNavigator} />

        {/* Wallet flows */}
        <Stack.Screen name="WalletSettings" component={WalletSettingsScreen} options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="Activity" component={UnifiedActivityScreen} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <Stack.Screen name="CurrencyPicker" component={CurrencyPickerScreen} />
        <Stack.Screen name="WalletReview" component={WalletReviewScreen} />
        <Stack.Screen name="WalletSuccess" component={WalletSuccessScreen} options={{ animation: 'fade' }} />

        {/* Send money flows
         *
         * TRANSITION RULE — read before editing these options:
         *
         * SendMoney and SendSuccess both use a custom Reanimated slide animation
         * (enterY / slideY) to move their content off-screen before calling
         * navigation.popToTop().  For this to work without a blank-screen flash,
         * BOTH screens MUST be declared with  presentation: 'transparentModal'.
         *
         * Why transparentModal matters:
         *   - Regular stack screens: iOS UIKit does NOT keep the screen beneath
         *     them composited.  When the JS content translates off-screen the
         *     native view behind it is blank (white window background) until
         *     popToTop() completes its own transition.  This produces the flash.
         *   - transparentModal screens: UIKit keeps the presenting screen (Main /
         *     WalletsScreen) fully rendered and visible at all times.  As the
         *     animated content slides away, wallets are revealed naturally.
         *     popToTop() then just removes the transparent overlay — no flash.
         *
         * STRICTLY NOT ALLOWED on these screens:
         *   - Removing  presentation: 'transparentModal'  (causes blank flash)
         *   - Removing  contentStyle: { backgroundColor: 'transparent' }
         *   - Replacing  animation: 'none'  with any native transition
         *   - Calling  navigation.goBack()  instead of  navigation.popToTop()
         *     when multiple transparent screens are stacked
         *   - Running the JS exit animation AFTER popToTop (wrong order — animate
         *     first, navigate when the callback fires)
         *
         * SendMoney inline-success path (handleCloseToWallets):
         *   setShowSuccessBg(false) → slide enterY to screenHeight → popToTop()
         * SendSuccess standalone path (handleBack):
         *   slide slideY to screenHeight → popToTop()
         */}
        <Stack.Screen name="SendMoney" component={SendMoneyScreen} options={{ animation: 'none', presentation: 'transparentModal', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="SendSuccess" component={SendSuccessScreen} options={{ animation: 'none', presentation: 'transparentModal', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="SendError" component={SendErrorScreen} options={{ animation: 'fade', gestureEnabled: false }} />

        {/* Card flows */}
        <Stack.Screen name="WalletCardList" component={WalletCardListScreen} />
        <Stack.Screen name="CardDetail" component={CardDetailScreen} />
        <Stack.Screen name="AddCardType" component={AddCardTypeScreen} />
        <Stack.Screen name="AddCardName" component={AddCardNameScreen} />
        <Stack.Screen name="AddCardColor" component={AddCardColorScreen} />
        <Stack.Screen name="AddCardReview" component={AddCardReviewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    alignItems: 'flex-end',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 14,
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  sendBtnOverlay: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sendBtn: {
    alignItems: 'center',
  },
  sendCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#441306',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 4,
  },
  sendCirclePressed: {
    backgroundColor: colors.brandDark,
  },
  sendLabel: {
    fontSize: 11,
    fontWeight: typography.medium,
    color: colors.textMuted,
  },
});
