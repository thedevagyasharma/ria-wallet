import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';

import { colors } from '../../theme';
import { useWalletStore } from '../../stores/useWalletStore';
import { useCardStore } from '../../stores/useCardStore';
import type { RootStackProps, RootStackParamList } from '../../navigation/types';
import { isCardTx } from '../../components/TransactionView';
import CardTransactionDetail from './CardTransactionDetail';
import WalletTransactionDetail from './WalletTransactionDetail';
import { sharedStyles } from './transactionDetailShared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TransactionDetailScreen({ route }: RootStackProps<'TransactionDetail'>) {
  const { txId, mode = 'detail' } = route.params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, wallets } = useWalletStore();
  const cards = useCardStore((s) => s.cards);

  const tx = transactions.find((t) => t.id === txId);

  if (!tx) {
    return (
      <View style={[sharedStyles.safe, { paddingTop: insets.top }]}>
        <View style={sharedStyles.navbar}>
          <Pressable onPress={() => navigation.goBack()} style={sharedStyles.navCloseBtn}>
            <X size={20} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={sharedStyles.notFound}>
          <Text style={sharedStyles.notFoundText}>Transaction not found.</Text>
        </View>
      </View>
    );
  }

  const wallet = wallets.find((w) => w.id === tx.walletId);
  const card   = tx.cardId ? cards.find((c) => c.id === tx.cardId) : undefined;

  if (isCardTx(tx)) {
    return <CardTransactionDetail tx={tx} wallet={wallet} card={card} />;
  }

  return <WalletTransactionDetail tx={tx} wallet={wallet} mode={mode} />;
}
