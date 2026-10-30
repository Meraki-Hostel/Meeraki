// Success envelope. The frontend HTTP adapter reads `.data`.
export function ok(res, data, status = 200) {
  return res.status(status).json({ data, error: null, meta: { requestId: res.req.id } });
}
