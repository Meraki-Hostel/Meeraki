import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import propertyRoutes from "../modules/properties/property.routes.js";
import roomRoutes from "../modules/rooms/room.routes.js";
import studentRoutes from "../modules/students/student.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import complaintRoutes from "../modules/complaints/complaint.routes.js";
import miscRoutes from "../modules/misc/misc.routes.js";

const router = Router();
router.use("/auth", authRoutes);
router.use("/properties", propertyRoutes);
router.use("/students", studentRoutes);
router.use("/complaints", complaintRoutes);
// Rooms, beds, charges, payments and misc declare their own full sub-paths.
router.use("/", roomRoutes);
router.use("/", paymentRoutes);
router.use("/", miscRoutes);
export default router;
