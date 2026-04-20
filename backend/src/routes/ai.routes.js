import express from "express";
import {
	getPreConsultSummary,
	saveTranscript,
	cdssCheck,
	getHealthInsights
} from "../controllers/ai.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// GET /api/ai/pre-consult-summary/:appointmentId — Doctor only
router.get("/pre-consult-summary/:appointmentId", requireRole(["DOCTOR"]), getPreConsultSummary);

// POST /api/ai/save-transcript — Doctor/Patient
router.post("/save-transcript", saveTranscript);

// POST /api/ai/cdss-check — Doctor only
router.post("/cdss-check", requireRole(["DOCTOR"]), cdssCheck);

// GET /api/ai/health-insights — Patient only
router.get("/health-insights", requireRole(["PATIENT"]), getHealthInsights);

export default router;
