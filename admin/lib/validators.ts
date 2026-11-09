export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isIndianPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(value));
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}
