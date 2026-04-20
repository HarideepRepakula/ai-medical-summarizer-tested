import express from "express";
import {
	saveTranscript,
	cdssCheck,
	getHealthInsights
} from "../controllers/ai.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// POST /api/ai/save-transcript — Doctor/Patient
router.post("/save-transcript", saveTranscript);

// POST /api/ai/cdss-check — Doctor only
router.post("/cdss-check", requireRole(["DOCTOR"]), cdssCheck);

// GET /api/ai/health-insights — Patient only
router.get("/health-insights", requireRole(["PATIENT"]), getHealthInsights);

export default router;
