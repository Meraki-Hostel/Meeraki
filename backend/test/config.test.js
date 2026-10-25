import "./helpers/env.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb, disconnect, prisma } from "./helpers/db.js";
import { rawRequest } from "./helpers/api.js";

const BACKEND = fileURLToPath(new URL("..", import.meta.url));
const STRONG = "x".repeat(64);

/** Runs a snippet in a fresh Node process with the pinned test env plus overrides. */
function run(code, overrides = {}) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: BACKEND, encoding: "utf8", env: { ...process.env, ...overrides },
  });
}
const boot = (overrides) => run('await import("./src/config/env.js"); console.log("booted")', overrides);
const runFile = (file, overrides) => spawnSync(process.execPath, [file], {
  cwd: BACKEND, encoding: "utf8", env: { ...process.env, ...overrides },
});

const PROD_OK = {
  NODE_ENV: "production", PAYMENT_MODE: "razorpay", JWT_ACCESS_SECRET: STRONG, JWT_REFRESH_SECRET: STRONG + "y",
  CORS_ORIGINS: "https://app.example.test", RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w",
};

before(resetDb);
after(async () => { await resetDb(); await disconnect(); });

describe("start-up guards", () => {
  test("a properly configured production environment boots", () => {
    const r = boot(PROD_OK);
    assert.equal(r.status, 0, r.stderr);
  });

  test("local development with the .env.example defaults still boots", () => {
    const r = boot({ NODE_ENV: "development", PAYMENT_MODE: "simulated", JWT_ACCESS_SECRET: "replace_me_access", JWT_REFRESH_SECRET: "replace_me_refresh", CORS_ORIGINS: "http://localhost:5173" });
    assert.equal(r.status, 0, r.stderr);
  });

  test("[DEF-B5] production refuses PAYMENT_MODE=simulated (no-money 'payments')", () => {
    const r = boot({ ...PROD_OK, PAYMENT_MODE: "simulated" });
    assert.notEqual(r.status, 0, "production booted with simulated payments");
    assert.match(r.stderr, /PAYMENT_MODE=simulated/);
  });

  test("[DEF-B5] production refuses placeholder JWT secrets", () => {
    const r = boot({ ...PROD_OK, JWT_ACCESS_SECRET: "replace_me_access", JWT_REFRESH_SECRET: "replace_me_refresh" });
    assert.notEqual(r.status, 0, "production booted with the .env.example placeholder secrets");
    assert.match(r.stderr, /JWT_ACCESS_SECRET/);
    assert.match(r.stderr, /JWT_REFRESH_SECRET/);
  });

  test("production refuses short JWT secrets and identical access/refresh secrets", () => {
    assert.notEqual(boot({ ...PROD_OK, JWT_ACCESS_SECRET: "too-short" }).status, 0);
    assert.notEqual(boot({ ...PROD_OK, JWT_ACCESS_SECRET: STRONG, JWT_REFRESH_SECRET: STRONG }).status, 0);
  });

  test("[DEF-B5] production refuses CORS_ORIGINS=*", () => {
    const r = boot({ ...PROD_OK, CORS_ORIGINS: "*" });
    assert.notEqual(r.status, 0, "production booted allowing every origin");
  });

  test("[DEF-B5] production refuses an empty CORS allowlist", () => {
    const r = boot({ ...PROD_OK, CORS_ORIGINS: "" });
    assert.notEqual(r.status, 0, "production booted with no allowed origins configured");
  });

  test("production with PAYMENT_MODE=razorpay requires all three Razorpay settings", () => {
    for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]) {
      const r = boot({ ...PROD_OK, [k]: "" });
      assert.notEqual(r.status, 0, `${k} missing but production booted`);
      assert.match(r.stderr, new RegExp(k));
    }
  });

  test("an invalid APP_TIMEZONE is rejected, a valid one is accepted", () => {
    assert.notEqual(boot({ NODE_ENV: "development", APP_TIMEZONE: "Mars/Olympus" }).status, 0);
    assert.equal(boot({ NODE_ENV: "development", APP_TIMEZONE: "Asia/Kolkata" }).status, 0);
  });

  test("PAYMENT_MODE defaults to disabled, and production may run with online payment disabled", () => {
    const r = run('const { env } = await import("./src/config/env.js"); console.log(env.payments.mode)', { NODE_ENV: "development", PAYMENT_MODE: "" });
    assert.equal(r.stdout.trim(), "disabled", r.stderr);
    assert.equal(boot({ ...PROD_OK, PAYMENT_MODE: "disabled", RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "", RAZORPAY_WEBHOOK_SECRET: "" }).status, 0);
  });

  test("live Razorpay keys are refused unless PAYMENTS_LIVE_ENABLED=true", () => {
    const live = { ...PROD_OK, RAZORPAY_KEY_ID: "rzp_live_abc" };
    const r = boot(live);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /PAYMENTS_LIVE_ENABLED/);
    assert.notEqual(boot({ ...live, NODE_ENV: "development" }).status, 0, "live keys must be gated in every environment");
    assert.equal(boot({ ...live, PAYMENTS_LIVE_ENABLED: "true" }).status, 0);
  });

  test("an unknown PAYMENT_MODE is rejected in every environment", () => {
    assert.notEqual(boot({ NODE_ENV: "development", PAYMENT_MODE: "free" }).status, 0);
  });

  test("the error names the settings but never prints their values", () => {
    const secret = "short-secret-value-123";
    const r = boot({ ...PROD_OK, JWT_ACCESS_SECRET: secret });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /JWT_ACCESS_SECRET/);
    assert.ok(!r.stderr.includes(secret), "a secret value leaked into the start-up error");
  });
});

describe("demo seed (local development only)", () => {
  test("seeds the demo hostel and users in development", async () => {
    await resetDb();
    const r = runFile("prisma/seed.js", { NODE_ENV: "development" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(await prisma.user.count(), 3);
  });

  test("[DEF-SEED] refuses to run when NODE_ENV=production", async () => {
    await resetDb();
    const r = runFile("prisma/seed.js", { NODE_ENV: "production" });
    const users = await prisma.user.count();
    assert.ok(r.status !== 0 && users === 0, `seed exited ${r.status} and created ${users} demo users with the shared password`);
  });
});

describe("production seed: first owner only", () => {
  const OWNER = { ORG_NAME: "First Hostels Pvt Ltd", OWNER_NAME: "First Owner", OWNER_EMAIL: "First.Owner@Example.test", OWNER_PHONE: "9876501234", OWNER_PASSWORD: "a-long-real-passphrase" };

  test("creates exactly one owner and nothing else, who can sign in with the chosen password", async () => {
    await resetDb();
    const r = runFile("prisma/seed-prod.js", { NODE_ENV: "production", ...OWNER });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!r.stdout.includes(OWNER.OWNER_PASSWORD) && !r.stderr.includes(OWNER.OWNER_PASSWORD), "password was printed");
    assert.equal(await prisma.user.count(), 1);
    assert.equal(await prisma.organization.count(), 1);
    assert.equal((await prisma.user.findFirst()).orgId, (await prisma.organization.findFirst()).id);
    for (const model of ["property", "room", "bed", "studentProfile", "rentCharge", "payment"]) {
      assert.equal(await prisma[model].count(), 0, `${model} rows were created`);
    }
    const ok = await rawRequest().post("/api/v1/auth/login").send({ role: "owner", identifier: "first.owner@example.test", password: OWNER.OWNER_PASSWORD });
    assert.equal(ok.status, 200);
    const demo = await rawRequest().post("/api/v1/auth/login").send({ role: "owner", identifier: "first.owner@example.test", password: "meraki@123" });
    assert.equal(demo.status, 401);
  });

  test("refuses to run when any user already exists", async () => {
    const r = runFile("prisma/seed-prod.js", { NODE_ENV: "production", ...OWNER, OWNER_EMAIL: "second@example.test" });
    assert.notEqual(r.status, 0);
    assert.equal(await prisma.user.count(), 1);
  });

  test("refuses missing details, a short password and the demo password", async () => {
    await resetDb();
    for (const bad of [{ ORG_NAME: "" }, { OWNER_NAME: "" }, { OWNER_EMAIL: "nope" }, { OWNER_PHONE: "123" }, { OWNER_PASSWORD: "short" }, { OWNER_PASSWORD: "meraki@123" }]) {
      const r = runFile("prisma/seed-prod.js", { NODE_ENV: "production", ...OWNER, ...bad });
      assert.notEqual(r.status, 0, JSON.stringify(Object.keys(bad)));
    }
    assert.equal(await prisma.user.count(), 0);
  });
});
