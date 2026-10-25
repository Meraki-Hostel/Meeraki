import { v4 as uuid } from "uuid";
export function requestId(req, res, next) {
  req.id = req.headers["x-request-id"] || uuid();
  res.setHeader("x-request-id", req.id);
  next();
}
