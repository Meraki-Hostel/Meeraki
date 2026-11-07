import { cn } from '@/lib/cn';

const PALETTES = [
  { wall: '#e7d2bb', accent: '#c9876f', sky: '#f4e2cc' },
  { wall: '#e9dccb', accent: '#9aa8c4', sky: '#efe4d6' },
  { wall: '#dfcab2', accent: '#a07b5c', sky: '#f2e3cf' },
  { wall: '#eddcc6', accent: '#b8665b', sky: '#f6e5cf' },
  { wall: '#e3d6c8', accent: '#7f8f6a', sky: '#efe6da' },
];

/** Illustrated building facade used for property cards (offline-safe). */
export function PropertyImage({ variant, name, className }: { variant: number; name: string; className?: string }) {
  const p = PALETTES[Math.abs(variant) % PALETTES.length]!;
  const floors = 4 + (variant % 3);
  return (
    <svg viewBox="0 0 120 90" className={cn('block', className)} role="img" aria-label={`Illustration of ${name}`} preserveAspectRatio="xMidYMid slice">
      <rect width="120" height="90" fill={p.sky} />
      <rect x="22" y={84 - floors * 12} width="62" height={floors * 12 + 6} fill={p.wall} />
      <rect x="22" y={84 - floors * 12} width="16" height={floors * 12 + 6} fill={p.accent} opacity="0.85" />
      {Array.from({ length: floors }).flatMap((_, r) => [0, 1, 2].map((c) => (
        <rect key={`${r}-${c}`} x={44 + c * 13} y={88 - floors * 12 + r * 12} width="8" height="7" rx="1" fill={(r + c + variant) % 4 === 0 ? '#f4d39d' : '#7b5c4f'} opacity={(r + c + variant) % 4 === 0 ? 1 : 0.55} />
      )))}
      <rect x="84" y="56" width="22" height="34" fill={p.wall} opacity="0.8" />
      <circle cx="12" cy="66" r="12" fill="#7b8652" /><rect x="11" y="70" width="2" height="20" fill="#6b4b3f" />
      <circle cx="110" cy="70" r="10" fill="#8e9a62" />
      <rect y="86" width="120" height="4" fill="#cdb193" />
    </svg>
  );
}
