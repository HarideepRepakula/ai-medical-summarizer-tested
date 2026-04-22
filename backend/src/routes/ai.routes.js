import express from "express";
import {
	saveTranscript,
	cdssCheck,
	getHealthInsights,
	getPreConsultSummary,
	getMedicalSummary,
	getBartSummary       // backward-compatible alias → same as getMedicalSummary
} from "../controllers/ai.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// POST /api/ai/save-transcript — Doctor/Patient
router.post("/save-transcript", saveTranscript);

// POST /api/ai/cdss-check — Doctor only
router.post("/cdss-check", requireRole(["DOCTOR"]), cdssCheck);

// GET /api/ai/health-insights — Patient only
router.get("/health-insights", requireRole(["PATIENT"]), getHealthInsights);

// GET /api/ai/pre-consult-summary/:appointmentId — Doctor only
router.get("/pre-consult-summary/:appointmentId", requireRole(["DOCTOR"]), getPreConsultSummary);

// POST /api/ai/summarize — Ollama medical summarizer (replaces BART)
router.post("/summarize", getMedicalSummary);

// POST /api/ai/bart-summary — Backward-compatible alias (now uses Ollama)
router.post("/bart-summary", getBartSummary);

export default router;
