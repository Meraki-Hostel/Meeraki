import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import invitationRoutes from "../modules/invitations/invitation.routes.js";
import propertyRoutes from "../modules/properties/property.routes.js";
import roomRoutes from "../modules/rooms/room.routes.js";
import studentRoutes from "../modules/students/student.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import miscRoutes from "../modules/misc/misc.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.routes.js";
import uploadRoutes from "../modules/uploads/upload.routes.js";
import { moduleRoutes } from "./modules.js";

const router = Router();
router.use("/auth", authRoutes);
router.use("/invitations", invitationRoutes);
router.use("/properties", propertyRoutes);
router.use("/students", studentRoutes);
router.use("/settings", settingsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/uploads", uploadRoutes);
for (const [path, routes] of moduleRoutes) router.use(path, routes);
// Rooms, beds, charges, payments and misc declare their own full sub-paths.
router.use("/", roomRoutes);
router.use("/", paymentRoutes);
router.use("/", miscRoutes);
export default router;
