import "./env.js";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { signAccessToken } from "../../src/utils/tokens.js";
import { TEST_PASSWORD } from "./db.js";

export const app = createApp();
const BASE = "/api/v1";
const cache = new Map();

/** Real password login (works with or without any demo-auth backdoor). */
export async function tokenFor(user) {
  if (cache.has(user.id)) return cache.get(user.id);
  const res = await request(app).post(`${BASE}/auth/login`).send({
    role: user.role, identifier: user.email, password: TEST_PASSWORD,
  });
  if (res.status !== 200) throw new Error(`test login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  cache.set(user.id, res.body.data.accessToken);
  return res.body.data.accessToken;
}
export const clearTokens = () => cache.clear();

/** Request builder bound to a token (or anonymous when token is undefined). */
export function api(token) {
  const auth = (r) => (token ? r.set("Authorization", `Bearer ${token}`) : r);
  return {
    get: (p, query = {}) => auth(request(app).get(BASE + p).query(query)),
    post: (p, body = {}) => auth(request(app).post(BASE + p).send(body)),
    patch: (p, body = {}) => auth(request(app).patch(BASE + p).send(body)),
  };
}

/**
 * Token for a seeded user without going through /auth/login (which is rate
 * limited to 30 per 15 min). Uses the app's own signer, so claims track the app.
 */
export function mintToken(user) {
  return signAccessToken({ userId: user.id, role: user.role, propertyId: user.propertyId, studentId: user.studentId });
}

/** Shortcut: an api bound to a seeded user. */
export async function as(user) {
  return api(mintToken(user));
}

export const rawRequest = () => request(app);
