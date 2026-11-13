import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { ApiError, toApiError } from '@/api/errors';
import { humanize } from '@/lib/format';
import { color, radius, space, statusTone, tone as tones, type Tone } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Scrollable screen body with pull-to-refresh. */
export function Screen({ children, onRefresh, refreshing = false, padded = true }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean;
}) {
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[padded && s.padded, { paddingBottom: space.xl * 2 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [s.card, style, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title} accessibilityRole="header">{children}</Text>;
}
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: space.lg }}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}
export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Text style={[s.body, muted && { color: color.dust }, style as object]}>{children}</Text>;
}
export function Strong({ children }: { children: ReactNode }) { return <Text style={s.strong}>{children}</Text>; }

export function Badge({ label, tone }: { label: string; tone?: Tone }) {
  const t = tones[tone ?? statusTone(label)];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]}>{humanize(label)}</Text>
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const v = BUTTON[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [s.button, { backgroundColor: v.bg, borderColor: v.border }, pressed && { opacity: 0.8 }, off && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={v.fg} style={{ marginRight: 6 }} />}
          <Text style={[s.buttonText, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
const BUTTON = {
  primary: { bg: color.primary, fg: color.white, border: color.primary },
  secondary: { bg: color.card, fg: color.primaryDark, border: color.lineStrong },
  danger: { bg: color.brick, fg: color.white, border: color.brick },
  ghost: { bg: 'transparent', fg: color.primaryDark, border: 'transparent' },
};

export function Field({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={color.mute}
        accessibilityLabel={label}
        {...input}
        style={[s.input, input.multiline && { minHeight: 96, textAlignVertical: 'top' }, !!error && { borderColor: color.brick }]}
      />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/** A row of mutually exclusive chips (filters, enums, tabs). */
export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T | undefined; onChange: (v: T) => void; label?: string;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      {label && <Text style={s.label}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={[s.chip, on && { backgroundColor: color.primary, borderColor: color.primary }]}>
              <Text style={[s.chipText, on && { color: color.white }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Row({ title, subtitle, right, icon, onPress }: {
  title: string; subtitle?: string; right?: ReactNode; icon?: IconName; onPress?: () => void;
}) {
  const content = (
    <>
      {icon && <Ionicons name={icon} size={22} color={color.primary} style={{ marginRight: space.md }} />}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={2}>{title}</Text>
        {!!subtitle && <Text style={s.rowSub} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={18} color={color.mute} style={{ marginLeft: space.sm }} />}
    </>
  );
  if (!onPress) return <View style={s.row}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, tone && { color: tones[tone].fg }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}
export function StatGrid({ children }: { children: ReactNode }) { return <View style={s.statGrid}>{children}</View>; }

export function Loading() {
  return <View style={s.center}><ActivityIndicator size="large" color={color.primary} /></View>;
}

export function Empty({ title, body, icon = 'file-tray-outline' }: { title: string; body?: string; icon?: IconName }) {
  return (
    <View style={[s.center, { paddingVertical: space.xl }]}>
      <Ionicons name={icon} size={36} color={color.mute} />
      <Text style={[s.strong, { marginTop: space.sm }]}>{title}</Text>
      {!!body && <Text style={[s.body, { color: color.dust, textAlign: 'center' }]}>{body}</Text>}
    </View>
  );
}

/** Error state. "Not set up" errors read as unavailable, never as a failure the user caused. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = toApiError(error);
  const unavailable = e.isUnavailableFeature;
  return (
    <View style={[s.center, { paddingVertical: space.xl }]}>
      <Ionicons name={unavailable ? 'construct-outline' : e.code === 'UNAVAILABLE' ? 'cloud-offline-outline' : 'alert-circle-outline'} size={36} color={unavailable ? color.amber : color.brick} />
      <Text style={[s.strong, { marginTop: space.sm, textAlign: 'center' }]}>{unavailable ? 'Not available yet' : e.code === 'UNAVAILABLE' ? "You're offline" : 'Something went wrong'}</Text>
      <Text style={[s.body, { color: color.dust, textAlign: 'center', marginBottom: space.md }]}>{e.message}</Text>
      {onRetry && !unavailable && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

/** Inline banner for a failed action (not a whole-screen error). */
export function Notice({ error, message, tone = 'bad' }: { error?: unknown; message?: string; tone?: Tone }) {
  const text = message ?? (error ? toApiError(error).message : undefined);
  if (!text) return null;
  const t = tones[error instanceof ApiError && error.isUnavailableFeature ? 'warn' : tone];
  return <View style={[s.notice, { backgroundColor: t.bg }]}><Text style={{ color: t.fg }}>{text}</Text></View>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  padded: { padding: space.lg },
  card: { backgroundColor: color.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg, marginBottom: space.md },
  title: { fontSize: 24, fontWeight: '700', color: color.ink, marginBottom: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: color.dust, textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { fontSize: 15, color: color.bark, lineHeight: 21 },
  strong: { fontSize: 16, fontWeight: '600', color: color.ink },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  button: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: color.bark, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.lineStrong, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16, color: color.ink, backgroundColor: color.white },
  error: { color: color.brick, marginTop: 4, fontSize: 13 },
  hint: { color: color.dust, marginTop: 4, fontSize: 13 },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: color.lineStrong, backgroundColor: color.card },
  chipText: { color: color.bark, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  rowTitle: { fontSize: 16, color: color.ink, fontWeight: '500' },
  rowSub: { fontSize: 13, color: color.dust, marginTop: 2 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: color.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg },
  statValue: { fontSize: 22, fontWeight: '700', color: color.ink },
  statLabel: { fontSize: 13, color: color.dust, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  notice: { borderRadius: radius.md, padding: space.md, marginBottom: space.md },
});
