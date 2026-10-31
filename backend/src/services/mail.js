import { env, isProd } from "../config/env.js";
import { notConfigured } from "../utils/ApiError.js";

// Outgoing email. MAIL_MODE (see config/env.js):
//   disabled → mailEnabled() is false; callers say the feature is not set up
//   console  → printed to the log and kept in `outbox` (development and tests)
//   resend   → sent through the Resend HTTP API
// The message text never goes to the log in resend mode (it can hold reset links).

/** Messages "sent" in console mode, newest last. Tests read links from here. */
export const outbox = [];

export const mailEnabled = () => env.mail.mode !== "disabled";

export function requireMail(what) {
  if (!mailEnabled()) throw notConfigured(`${what} needs email, which is not set up on this server yet. Ask your hostel admin.`);
}

export async function sendMail({ to, subject, text, html }) {
  requireMail("Sending email");
  if (env.mail.mode === "console") {
    outbox.push({ to, subject, text, at: new Date() });
    if (outbox.length > 200) outbox.shift();
    if (!isProd && env.nodeEnv !== "test") console.log(`\n[mail] to ${to}: ${subject}\n${text}\n`);
    return { id: `console-${outbox.length}` };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.mail.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.mail.from, to: [to], subject, text, html: html ?? textToHtml(text) }),
  });
  if (!res.ok) {
    // Never echo the body we sent; the provider's error explains the refusal.
    throw new Error(`Email provider refused the message: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function textToHtml(text) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = esc.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${linked.replace(/\n/g, "<br>")}</div>`;
}

/** "a•••@gmail.com" — shown after a reset request without revealing the address. */
export function maskEmail(email) {
  const [user, domain] = String(email).split("@");
  if (!domain) return "your registered email";
  return `${user.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`;
}
