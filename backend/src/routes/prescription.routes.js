import express from "express";
import { createPrescription, getPrescriptions } from "../controllers/prescription.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// POST /api/prescriptions — Doctor only
router.post("/", requireRole(["DOCTOR"]), createPrescription);

// GET /api/prescriptions — Doctor or Patient
router.get("/", requireRole(["DOCTOR", "PATIENT", "ADMIN"]), getPrescriptions);

export default router;
