import "./helpers/env.js";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

const makeNote = (user) => prisma.notification.create({
  data: { recipientUserId: user.id, title: "Test", body: "Hello", category: "system" },
});

describe("PATCH /notifications/:id", () => {
  test("the recipient can mark their own notification read", async () => {
    const note = await makeNote(w.users.studentA);
    const res = await (await as(w.users.studentA)).patch(`/notifications/${note.id}`, { read: true });
    assert.equal(res.status, 200);
    assert.equal((await prisma.notification.findUnique({ where: { id: note.id } })).read, true);
  });

  test("an unknown id is NOT_FOUND", async () => {
    const res = await (await as(w.users.studentA)).patch("/notifications/does-not-exist", { read: true });
    assert.equal(res.status, 404);
  });

  test("someone else's notification is NOT_FOUND and stays unread", async () => {
    const note = await makeNote(w.users.studentA);
    const res = await (await as(w.users.studentB)).patch(`/notifications/${note.id}`, { read: true });
    assert.equal(res.status, 404);
    assert.equal((await prisma.notification.findUnique({ where: { id: note.id } })).read, false);
  });
});