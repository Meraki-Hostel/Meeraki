// Rules for passwords people choose (invitation, reset, change). Mirrors the
// frontend's strength meter: 8+ characters with a letter and a number or symbol.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789", "1234567890", "qwerty123",
  "qwertyuiop", "iloveyou1", "admin123", "welcome1", "welcome123", "letmein1", "abc12345", "meraki@123",
  "staypookie123", "hostel123", "india@123", "changeme1", "11111111", "00000000", "asdf1234", "zxcvbnm1",
]);

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password, { email = "", name = "" } = {}) {
  const pw = String(password ?? "");
  if (pw.length < 8) return "Password must be at least 8 characters";
  // bcrypt only reads the first 72 bytes; refuse longer so nothing is silently ignored.
  if (Buffer.byteLength(pw, "utf8") > 72) return "Password must be at most 72 characters";
  if (!/[A-Za-z]/.test(pw) || !/[\d\W_]/.test(pw)) return "Use a mix of letters and at least one number or symbol";
  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) return "This password is too common. Choose another";
  const local = String(email).toLowerCase().split("@")[0];
  if ((local.length >= 4 && lower.includes(local)) || lower === String(email).toLowerCase()) return "Password must not contain your email address";
  const first = String(name).toLowerCase().split(/\s+/)[0];
  if (first.length >= 4 && lower.includes(first)) return "Password must not contain your name";
  return null;
}
