export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;
export type Rule = (value: unknown) => string | undefined;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

export const rules = {
  required: (label = 'This field'): Rule => (v) => (str(v) === '' ? `${label} is required` : undefined),
  minLength: (n: number, label = 'This field'): Rule => (v) => (str(v) && str(v).length < n ? `${label} must be at least ${n} characters` : undefined),
  maxLength: (n: number, label = 'This field'): Rule => (v) => (str(v).length > n ? `${label} must be ${n} characters or fewer` : undefined),
  email: (): Rule => (v) => (str(v) && !isEmail(str(v)) ? 'Enter a valid email address' : undefined),
  phone: (): Rule => (v) => (str(v) && !isIndianPhone(str(v)) ? 'Enter a 10-digit Indian mobile number' : undefined),
  emailOrPhone: (): Rule => (v) => (str(v) && !isEmail(str(v)) && !isIndianPhone(str(v)) ? 'Enter a valid email or 10-digit mobile number' : undefined),
  positive: (label = 'Amount'): Rule => (v) => (str(v) !== '' && !(Number(v) > 0) ? `${label} must be greater than zero` : undefined),
  nonNegative: (label = 'Value'): Rule => (v) => (str(v) !== '' && !(Number(v) >= 0) ? `${label} cannot be negative` : undefined),
  integer: (label = 'Value'): Rule => (v) => (str(v) !== '' && !Number.isInteger(Number(v)) ? `${label} must be a whole number` : undefined),
  pincode: (): Rule => (v) => (str(v) && !/^\d{6}$/.test(str(v)) ? 'Enter a 6-digit PIN code' : undefined),
};

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
export function isIndianPhone(v: string): boolean {
  const d = v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '');
  return /^[6-9]\d{9}$/.test(d);
}
export function normalizePhone(v: string): string {
  return v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '');
}

export function validate<T extends Record<string, unknown>>(
  values: T,
  schema: Partial<Record<keyof T, Rule[]>>,
): FieldErrors<Extract<keyof T, string>> {
  const errors: FieldErrors<Extract<keyof T, string>> = {};
  for (const key of Object.keys(schema) as Extract<keyof T, string>[]) {
    for (const rule of schema[key] ?? []) {
      const msg = rule(values[key]);
      if (msg) { errors[key] = msg; break; }
    }
  }
  return errors;
}
export const hasErrors = (e: object): boolean => Object.values(e).some(Boolean);

export function passwordStrength(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: s as 0 | 1 | 2 | 3 | 4, label: labels[s]! };
}
