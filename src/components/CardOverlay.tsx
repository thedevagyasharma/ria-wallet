import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Filter,
  FeTurbulence,
  FeColorMatrix,
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
  const edgeId  = `edge-${id}`;
  const noiseId = `noise-${id}`;
  const inset   = strokeWidth / 2;
  const rx      = borderRadius - inset;

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

      {/* Noise + highlight/shadow */}
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
          <Filter id={noiseId} x="0%" y="0%" width="100%" height="100%">
            <FeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <FeColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0" />
          </Filter>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="white" filter={`url(#${noiseId})`} />

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
