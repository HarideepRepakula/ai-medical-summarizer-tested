import { Router } from "express";
import authRoutes          from "./auth.routes.js";
import doctorRoutes        from "./doctor.routes.js";
import appointmentRoutes   from "./appointment.routes.js";
import scheduleRoutes      from "./schedule.routes.js";
import recordsRoutes       from "./records.routes.js";
import medicalRecordsRoutes from "./medicalRecords.routes.js";
import aiRoutes            from "./ai.routes.js";
import pharmacyRoutes      from "./pharmacy.routes.js";
import chatbotRoutes       from "./chatbot.routes.js";
import prescriptionRoutes  from "./prescription.routes.js";
import notificationRoutes  from "./notification.routes.js";
import { authenticate }    from "../middleware/auth.js";

const router = Router();

router.get("/health", (_req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString(), version: "2.1.0-ai" });
});

// ── Public routes ────────────────────────────────────────────────────────────
router.use("/auth", authRoutes);

// ── Authenticated routes ─────────────────────────────────────────────────────
router.use("/doctors",       authenticate, doctorRoutes);
router.use("/appointments",  authenticate, appointmentRoutes);
router.use("/schedule",      authenticate, scheduleRoutes);
router.use("/records",         authenticate, recordsRoutes);
router.use("/medical-records", authenticate, medicalRecordsRoutes);
router.use("/ai",              authenticate, aiRoutes);
router.use("/pharmacy",      authenticate, pharmacyRoutes);
router.use("/chatbot",       authenticate, chatbotRoutes);
router.use("/prescriptions", authenticate, prescriptionRoutes);
router.use("/notifications", authenticate, notificationRoutes);

export default router;
