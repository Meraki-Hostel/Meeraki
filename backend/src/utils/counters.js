// Named sequences (receipt numbers, ticket numbers, ...) incremented atomically.
// A single INSERT … ON CONFLICT is safe even when the counter row does not exist
// yet (an upsert's read-then-insert is not). Called inside the creating
// transaction, so a rollback gives the number back.
export async function nextValue(tx, key) {
  const [{ value }] = await tx.$queryRaw`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return Number(value);
}

export const pad = (n, width = 4) => String(n).padStart(width, "0");
