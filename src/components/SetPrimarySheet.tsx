import React from 'react';
import { Star } from 'lucide-react-native';
import { colors } from '../theme';
import ConfirmSheet from './ConfirmSheet';

type Props = {
  visible: boolean;
  walletLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function alpha(hex: string, o: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${o})`;
}

export default function SetPrimarySheet({ visible, walletLabel, onConfirm, onCancel }: Props) {
  return (
    <ConfirmSheet
      visible={visible}
      icon={<Star size={26} color={colors.brand} strokeWidth={1.8} fill={colors.brand} />}
      iconBg={alpha(colors.brand, 0.1)}
      title={`Set ${walletLabel} as primary?`}
      body={`Your ${walletLabel} wallet will be used by default for sending and receiving money.`}
      confirmLabel="Set as primary"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
