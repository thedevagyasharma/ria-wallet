import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';

type Props = {
  id: string;          // unique per card to avoid SVG def ID collisions
  width: number;
  height: number;
  borderRadius: number;
  strokeWidth?: number;
};

export default function CardOverlay({ id, width, height, borderRadius, strokeWidth = 2 }: Props) {
  const edgeId = `edge-${id}`;
  const inset  = strokeWidth / 2;
  const rx     = borderRadius - inset;

  return (
    <>
      {/* Sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Edge highlight ring */}
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      >
        <Defs>
          <SvgLinearGradient
            id={edgeId}
            x1={0} y1={0} x2={0} y2={height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0"    stopColor="#ffffff" stopOpacity="0.10" />
            <Stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="0.65" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1"    stopColor="#000000" stopOpacity="0.15" />
          </SvgLinearGradient>
        </Defs>

        <Rect
          x={inset} y={inset}
          width={width - strokeWidth} height={height - strokeWidth}
          rx={rx} ry={rx}
          fill="none"
          stroke={`url(#${edgeId})`}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </>
  );
}
