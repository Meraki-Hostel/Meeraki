// Same palette as the web app (staypookie-frontend/src/styles/index.css).
export const color = {
  bg: '#f6efe4',        // ivory
  card: '#fffaf2',      // cream
  sand: '#efe4d4',
  line: '#e6d8c5',
  lineStrong: '#d6c3aa',
  ink: '#3b2622',       // espresso
  bark: '#5a4540',
  dust: '#7d6b63',
  mute: '#a39388',
  primary: '#8c5850',   // clay-600
  primaryDark: '#744640',
  primaryWash: '#f8ece8',
  moss: '#4c7a58', mossWash: '#e4efe2',
  amber: '#a6731f', amberWash: '#f7ebd2',
  brick: '#b0473e', brickWash: '#f7e1dc',
  slate: '#3f5784', slateWash: '#e7ecf5',
  white: '#ffffff',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'brand';
export const tone: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: color.bark, bg: color.sand },
  good: { fg: color.moss, bg: color.mossWash },
  warn: { fg: color.amber, bg: color.amberWash },
  bad: { fg: color.brick, bg: color.brickWash },
  info: { fg: color.slate, bg: color.slateWash },
  brand: { fg: color.primaryDark, bg: color.primaryWash },
};

/** Status → badge tone, shared by every list. */
export function statusTone(status?: string): Tone {
  switch (status) {
    case 'paid': case 'approved': case 'resolved': case 'closed': case 'completed': case 'verified':
    case 'checked_out': case 'active': case 'published': case 'captured':
      return 'good';
    case 'pending': case 'partial': case 'in_progress': case 'assigned': case 'on_hold': case 'uploaded':
    case 'acknowledged': case 'notice': case 'invited': case 'scheduled':
      return 'warn';
    case 'overdue': case 'rejected': case 'open': case 'urgent': case 'missing': case 'cancelled': case 'failed':
      return 'bad';
    case 'checked_in': case 'high':
      return 'info';
    default:
      return 'neutral';
  }
}
