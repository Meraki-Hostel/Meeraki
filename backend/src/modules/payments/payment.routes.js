import { Router } from "express";
import * as c from "./payment.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import {
  recordPaymentSchema, payNowSchema, remindersSchema, chargeFiltersSchema, paymentFiltersSchema,
} from "./payment.validation.js";

const r = Router();

// The webhook is mounted in app.js (it needs the raw body and no login).
// Authenticate only this router's own paths, so unknown URLs still reach the 404 handler.
r.use(["/charges", "/payments"], authenticate);
r.get("/charges", validate(chargeFiltersSchema, "query"), c.listCharges);
r.get("/payments", validate(paymentFiltersSchema, "query"), c.listPayments);
r.get("/payments/summary", c.summary);
r.get("/payments/:paymentId/receipt", c.getReceipt);
r.post("/payments/record", validate(recordPaymentSchema), c.recordPayment);
r.post("/payments/reminders", validate(remindersSchema), c.sendReminders);
r.post("/payments/pay-now", validate(payNowSchema), c.payNow);

export default r;
