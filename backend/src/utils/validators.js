export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const normalizePhone = (s) => String(s || "").replace(/\D/g, "").slice(-10);
export const isIndianPhone = (s) => /^[6-9]\d{9}$/.test(normalizePhone(s));
