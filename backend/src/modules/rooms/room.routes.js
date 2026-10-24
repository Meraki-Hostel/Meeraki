import { Router } from "express";
import * as c from "./room.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { createSchema, updateSchema, listSchema, bedStatusSchema, assignSchema, vacateSchema } from "./room.validation.js";
const r = Router();
// Mounted at "/": authenticate only this router's own paths, so unknown URLs reach the 404 handler.
r.use(["/rooms", "/beds"], authenticate);
r.get("/rooms", validate(listSchema, "query"), c.list);
r.post("/rooms", validate(createSchema), c.create);
r.patch("/rooms/:id", validate(updateSchema), c.update);
r.patch("/beds/:bedId/status", validate(bedStatusSchema), c.setBedStatus);
r.post("/beds/assign", validate(assignSchema), c.assignBed);
r.post("/beds/vacate", validate(vacateSchema), c.vacateBed);
export default r;
