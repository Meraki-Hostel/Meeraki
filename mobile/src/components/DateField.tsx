import { Pressable, Text, View } from 'react-native';
import { addDaysISO, date, isISODate, todayISO } from '@/lib/format';
import { Field } from './ui';
import { color, radius, space } from './theme';

/**
 * A date as YYYY-MM-DD (the API's format) with one-tap shortcuts. Typed, not a
 * native picker, so it behaves the same on every phone and needs no extra
 * native module.
 */
export function DateField({ label, value, onChange, error, from = 0, shortcuts = [0, 1, 7] }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
  /** Shortcuts are offsets from this many days after today. */
  from?: number; shortcuts?: number[];
}) {
  const base = addDaysISO(todayISO(), from);
  return (
    <View>
      <Field label={label} value={value} onChangeText={onChange} error={error} placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation" maxLength={10}
        hint={isISODate(value) ? date(value) : 'Year-month-day, e.g. 2026-11-20'} />
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: -space.sm, marginBottom: space.md, flexWrap: 'wrap' }}>
        {shortcuts.map((n) => {
          const d = addDaysISO(base, n);
          const text = from === 0 && n === 0 ? 'Today' : from === 0 && n === 1 ? 'Tomorrow' : date(d);
          return (
            <Pressable key={n} onPress={() => onChange(d)} accessibilityRole="button" accessibilityLabel={`${label}: ${text}`}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: value === d ? color.primary : color.sand }}>
              <Text style={{ color: value === d ? color.white : color.bark, fontWeight: '600' }}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
