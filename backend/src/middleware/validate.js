import { invalid } from "../utils/ApiError.js";
// Validate a part of the request with a Zod schema; emits fieldErrors.
export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const r = schema.safeParse(req[source]);
    if (!r.success) {
      const fieldErrors = {};
      for (const i of r.error.issues) fieldErrors[i.path.join(".")] = i.message;
      return next(invalid(fieldErrors));
    }
    req[source] = r.data;
    next();
  };
}
