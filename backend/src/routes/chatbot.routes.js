import express from "express";
import { askChatbot, escalateToDoctor, askConsultationChatbot } from "../controllers/chatbot.controller.js";

const router = express.Router();

// POST /api/chatbot/ask — General RAG chatbot
router.post("/ask", askChatbot);

// POST /api/chatbot/ask-consultation — Consultation-scoped RAG chatbot
router.post("/ask-consultation", askConsultationChatbot);

// POST /api/chatbot/escalate — Escalate to doctor
router.post("/escalate", escalateToDoctor);

export default router;
