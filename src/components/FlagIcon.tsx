import React from 'react';
import { View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as Flags from 'country-flag-icons/string/3x2';

interface Props {
  /** ISO 3166-1 alpha-2 country code, e.g. 'US', 'MX', 'EU' */
  code: string;
  /** Height in dp. Width is derived from the 3:2 aspect ratio. Default: 20 */
  size?: number;
  style?: ViewStyle;
}

export default function FlagIcon({ code, size = 20, style }: Props) {
  const svgXml = (Flags as Record<string, string>)[code.toUpperCase()];
  if (!svgXml) return null;

  const height = size;
  const width  = Math.round(size * 1.5);

  return (
    <View
      style={[{ width, height, overflow: 'hidden', borderRadius: 2 }, style]}
    >
      <SvgXml xml={svgXml} width={width} height={height} />
    </View>
  );
}
