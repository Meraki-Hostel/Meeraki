import { test } from "node:test";

// A defect test asserts the CORRECT behaviour. While the defect exists it fails,
// and is reported as TODO (it does not fail the run). Once the fix lands it
// passes, and its `defect(...)` wrapper is replaced with a plain `test(...)`.
//
//   npm test           known defects are reported as TODO
//   npm run test:strict known defects fail the run (STRICT_DEFECTS=1)
const strict = process.env.STRICT_DEFECTS === "1";

export const defect = (id, name, fn) =>
  test(`[${id}] ${name}`, { todo: strict ? false : `known defect ${id}` }, fn);
