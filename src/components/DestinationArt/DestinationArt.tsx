import { useId } from 'react';
import type { Destination } from '../../types/travel';
import './DestinationArt.css';

interface Props {
  destination: Destination;
  /** Visual variant: card thumbnails are simpler than the hero. */
  size?: 'card' | 'hero';
  className?: string;
}

/**
 * Illustrated destination artwork, drawn as SVG so the prototype ships with
 * no third-party images or licensing concerns. Purely decorative.
 */
export function DestinationArt({ destination, size = 'card', className }: Props) {
  const uid = useId().replace(/:/g, '');
  const { sky, horizon, accent, ground } = destination.palette;
  const sea = '#2f7fa3';

  return (
    <svg
      className={`destination-art destination-art--${size} ${className ?? ''}`}
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor={horizon} />
        </linearGradient>
        <linearGradient id={`sea-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sea} stopOpacity="0.85" />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
        <radialGradient id={`sun-${uid}`}>
          <stop offset="0" stopColor="#fff7e0" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="240" fill={`url(#sky-${uid})`} />
      <circle cx="300" cy="80" r="70" fill={`url(#sun-${uid})`} />
      <circle cx="300" cy="80" r="26" fill="#fff4d6" />
      <g fill="#ffffff" opacity="0.7">
        <ellipse cx="90" cy="54" rx="34" ry="8" />
        <ellipse cx="118" cy="48" rx="22" ry="7" />
        <ellipse cx="210" cy="36" rx="26" ry="6" />
      </g>

      <Scene destination={destination} uid={uid} ground={ground} accent={accent} />
    </svg>
  );
}

function Palm({ x, y, scale = 1, color }: { x: number; y: number; scale?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={color}>
      <path d="M0 0 C 4 -30, 8 -55, 2 -80 L 6 -80 C 13 -55, 9 -30, 5 0 Z" />
      <path d="M4 -80 C -20 -92, -40 -84, -48 -70 C -30 -80, -14 -80, 4 -78 Z" />
      <path d="M4 -80 C 26 -94, 46 -86, 52 -70 C 34 -82, 20 -80, 4 -78 Z" />
      <path d="M4 -80 C -6 -100, -26 -104, -36 -98 C -18 -96, -6 -90, 4 -79 Z" />
      <path d="M4 -80 C 16 -102, 36 -104, 44 -96 C 26 -94, 14 -88, 4 -79 Z" />
    </g>
  );
}

function Scene({ destination, uid, ground, accent }: { destination: Destination; uid: string; ground: string; accent: string }) {
  const dark = '#1f2a33';
  switch (destination.scene) {
    case 'beach':
      return (
        <g>
          <rect y="150" width="400" height="40" fill={`url(#sea-${uid})`} />
          <path d="M0 152 Q 100 146 200 152 T 400 152" stroke="#ffffff" strokeOpacity="0.5" fill="none" strokeWidth="2" />
          <path d="M0 178 C 90 168, 180 176, 260 186 C 320 194, 370 190, 400 186 L400 240 L0 240 Z" fill={ground} />
          <Palm x={70} y={200} scale={1.05} color={dark} />
          <Palm x={340} y={214} scale={0.8} color={dark} />
          <path d="M150 168 L 168 150 L 186 168 Z" fill="#ffffff" opacity="0.9" />
        </g>
      );
    case 'island':
      return (
        <g>
          <path d="M120 150 L 210 72 L 228 66 L 246 74 L 330 150 Z" fill={accent} opacity="0.85" />
          <path d="M200 82 L 210 72 L 228 66 L 246 74 L 256 84 L 236 80 L 222 86 Z" fill="#ffffff" opacity="0.85" />
          <rect y="148" width="400" height="44" fill={`url(#sea-${uid})`} />
          <path d="M0 184 C 100 174, 220 180, 400 190 L400 240 L0 240 Z" fill={ground} />
          <Palm x={60} y={210} scale={0.95} color={dark} />
          <Palm x={360} y={220} scale={0.7} color={dark} />
        </g>
      );
    case 'mountain':
      return (
        <g>
          <path d="M0 150 C 60 90, 120 80, 180 120 C 230 70, 300 60, 400 130 L400 240 L0 240 Z" fill={accent} opacity="0.9" />
          <path d="M0 175 C 80 140, 160 150, 240 170 C 300 150, 360 150, 400 160 L400 240 L0 240 Z" fill={ground} />
          <rect y="205" width="400" height="35" fill={`url(#sea-${uid})`} />
          <g fill="#ffffff">
            <rect x="248" y="168" width="18" height="16" />
            <rect x="270" y="172" width="14" height="12" />
            <path d="M246 168 L 257 160 L 268 168 Z" fill="#c2410c" />
            <path d="M268 172 L 277 165 L 286 172 Z" fill="#c2410c" />
          </g>
        </g>
      );
    case 'desert': {
      const isDubai = destination.id === 'dubai';
      return (
        <g>
          {isDubai ? (
            <g fill={accent} opacity="0.9">
              <path d="M228 170 L 236 40 L 244 170 Z" />
              <rect x="190" y="110" width="22" height="60" />
              <rect x="256" y="96" width="18" height="74" />
              <rect x="160" y="130" width="20" height="40" />
              <rect x="284" y="124" width="26" height="46" />
            </g>
          ) : (
            <g fill={accent} opacity="0.9">
              <rect x="180" y="80" width="26" height="90" />
              <rect x="176" y="74" width="34" height="10" />
              <rect x="188" y="62" width="10" height="12" />
              <path d="M120 170 L 120 128 Q 140 104 160 128 L 160 170 Z" />
              <path d="M230 170 L 230 132 Q 252 108 274 132 L 274 170 Z" />
            </g>
          )}
          <path d="M0 168 C 80 150, 160 160, 240 172 C 300 160, 360 160, 400 168 L400 240 L0 240 Z" fill={ground} />
          <path d="M0 196 C 100 180, 200 200, 300 196 C 340 194, 380 190, 400 194 L400 240 L0 240 Z" fill={accent} opacity="0.25" />
          {!isDubai && <Palm x={330} y={200} scale={0.9} color={dark} />}
        </g>
      );
    }
    case 'canal':
      return (
        <g>
          <g fill={accent}>
            {[40, 82, 120, 160, 204, 246, 290, 330].map((x, i) => {
              const h = 70 + ((i * 17) % 30);
              return (
                <g key={x}>
                  <rect x={x} y={170 - h} width="38" height={h} opacity={0.75 + (i % 3) * 0.08} />
                  <path d={`M${x} ${170 - h} L ${x + 19} ${150 - h} L ${x + 38} ${170 - h} Z`} opacity="0.9" />
                  <rect x={x + 8} y={190 - h} width="8" height="10" fill="#fff4d6" />
                  <rect x={x + 22} y={190 - h} width="8" height="10" fill="#fff4d6" />
                </g>
              );
            })}
          </g>
          <rect y="170" width="400" height="70" fill={`url(#sea-${uid})`} />
          <path d="M60 196 Q 200 186 340 196" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" fill="none" />
          <path d="M120 206 L 280 206 L 268 218 L 132 218 Z" fill={dark} />
        </g>
      );
    case 'city':
    default: {
      const seed = destination.id.length;
      return (
        <g>
          <g fill={accent} opacity="0.9">
            {[20, 62, 96, 140, 184, 232, 270, 318, 356].map((x, i) => {
              const h = 50 + (((i + seed) * 23) % 60);
              return <rect key={x} x={x} y={175 - h} width={30 + (i % 3) * 6} height={h} />;
            })}
            <path d="M190 120 Q 210 84 230 120 Z" />
            <rect x="207" y="70" width="6" height="22" />
          </g>
          <g fill="#fff4d6" opacity="0.8">
            {[30, 72, 150, 244, 330].map((x) => (
              <rect key={x} x={x} y="140" width="6" height="8" />
            ))}
          </g>
          <path d="M0 172 L 400 172 L 400 240 L 0 240 Z" fill={ground} />
          <path d="M0 200 C 120 192, 280 208, 400 198 L400 240 L0 240 Z" fill={accent} opacity="0.2" />
        </g>
      );
    }
  }
}
