/**
 * AI Service — MedHub AI+
 * Uses Ollama (local LLM) for all AI features.
 * Model: llama3.2 (fully local, no API key, no rate limits)
 *
 * Setup:
 *   1. Install Ollama: https://ollama.com
 *   2. Run: ollama pull llama3.2
 *   3. Ollama runs on http://localhost:11434 by default
 */

import { Ollama } from "ollama";

const OLLAMA_MODEL  = process.env.OLLAMA_MODEL  || "llama3.2";
const OLLAMA_HOST   = process.env.OLLAMA_HOST   || "http://localhost:11434";
const MEDICAL_DISCLAIMER = `\n\n---\n⚕️ **Medical Disclaimer**: This AI-generated content is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare professional for medical decisions.`;

// Singleton client
const client = new Ollama({ host: OLLAMA_HOST });

// ── Core helper ───────────────────────────────────────────────────────────────

async function generate(prompt) {
	const response = await client.generate({
		model:  OLLAMA_MODEL,
		prompt,
		stream: false,
		options: { temperature: 0.2, num_predict: 1024 }
	});
	return response.response.trim();
}

function stripFences(text) {
	return text
		.replace(/^```json\s*/i, "")
		.replace(/^```\s*/i, "")
		.replace(/```\s*$/i, "")
		.trim();
}

function safeJson(text, fallback) {
	try {
		return JSON.parse(stripFences(text));
	} catch {
		console.error("[OLLAMA] JSON parse failed:", text.substring(0, 200));
		return fallback;
	}
}

// ── Exported functions (same signatures as before) ────────────────────────────

/**
 * Parse raw OCR text from a lab report into structured JSON.
 */
export async function parseLabReportOcr(rawText) {
	const prompt = `You are a medical lab report parser.
Given the following raw OCR text extracted from a lab report, extract ALL test results.
Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "labName": "string or null",
  "recordDate": "YYYY-MM-DD or null",
  "doctorOrdered": "string or null",
  "tests": [
    {
      "testName": "string",
      "value": "string",
      "numericValue": number_or_null,
      "unit": "string or null",
      "referenceRange": "string or null",
      "flag": "normal|high|low|critical|unknown"
    }
  ]
}

Rules:
- numericValue must be a float extracted from value, or null if not parseable
- flag: if value > upper reference range → "high", < lower → "low", within → "normal", otherwise "unknown"
- Include ALL tests found

RAW OCR TEXT:
---
${rawText.substring(0, 4000)}
---`;

	const text = await generate(prompt);
	return safeJson(text, { tests: [], rawResponse: text });
}

/**
 * Generate a pre-consultation AI summary for a doctor.
 */
export async function generatePreConsultSummary({ patientName, prescriptions, labResults }) {
	const rxSummary = prescriptions.slice(0, 5).map((p, i) =>
		`${i + 1}. Prescribed on ${p.createdAt?.toISOString?.().split("T")[0] || "unknown"}: ` +
		p.medicines.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join(", ")
	).join("\n") || "No prescriptions on record.";

	const labSummary = labResults.slice(0, 5).map((l, i) =>
		`${i + 1}. ${l.fileName} (${l.recordDate?.toISOString?.().split("T")[0] || "unknown"}): ` +
		l.structuredData.slice(0, 6).map(t => `${t.testName}=${t.value}${t.unit || ""}`).join(", ")
	).join("\n") || "No lab results on record.";

	const prompt = `You are a clinical AI assistant helping a doctor prepare for a consultation.
Patient: ${patientName}

RECENT PRESCRIPTIONS:
${rxSummary}

RECENT LAB RESULTS:
${labSummary}

Generate a concise pre-consultation clinical brief in JSON format only (no markdown):
{
  "summary": "2-3 sentence clinical overview",
  "keyFindings": ["finding1", "finding2"],
  "flaggedLabValues": ["any abnormal values"],
  "recommendations": ["brief action items for the doctor"],
  "riskLevel": "low|moderate|high"
}`;

	const text = await generate(prompt);
	const parsed = safeJson(text, {
		summary: "Unable to generate summary.", keyFindings: [],
		flaggedLabValues: [], recommendations: [], riskLevel: "unknown"
	});
	return { ...parsed, disclaimer: MEDICAL_DISCLAIMER };
}

/**
 * CDSS drug interaction / contraindication check.
 */
export async function runCdssCheck({ medicationName, patientLabHistory, existingMedications }) {
	const labContext = patientLabHistory.slice(0, 5).flatMap(l =>
		l.structuredData.slice(0, 8).map(t => `${t.testName}: ${t.value}${t.unit || ""} (${t.flag})`)
	).join(", ") || "No lab data available";

	const meds = existingMedications.slice(0, 8).join(", ") || "None";

	const prompt = `You are a Clinical Decision Support System (CDSS) for a hospital.
A doctor is about to prescribe: "${medicationName}"

Patient's current medications: ${meds}
Patient's recent lab values: ${labContext}

Return ONLY valid JSON:
{
  "riskLevel": "safe|caution|warning|contraindicated",
  "interactions": ["interaction1"],
  "contraindications": ["contraindication1"],
  "labConcerns": ["concern based on lab values"],
  "recommendation": "brief clinical recommendation",
  "requiresAttention": true
}`;

	const text = await generate(prompt);
	const parsed = safeJson(text, {
		riskLevel: "caution", interactions: [], contraindications: [],
		labConcerns: [], recommendation: text, requiresAttention: true
	});
	return { ...parsed, disclaimer: MEDICAL_DISCLAIMER };
}

/**
 * RAG-based chatbot response using patient's medical context.
 */
export async function generateChatbotResponse({ userMessage, context }) {
	const prompt = `You are MedHub AI, a patient health assistant.
You ONLY answer questions about the patient's own medical records provided below.
Be concise, empathetic, and always recommend consulting a doctor for medical decisions.

PATIENT MEDICAL CONTEXT:
${context.substring(0, 3500)}

PATIENT QUESTION: ${userMessage}

Instructions:
- Answer based ONLY on the provided context
- If information is not in the context, say "I don't have that information in your records"
- Never diagnose or prescribe
- Keep response under 150 words`;

	const answer = await generate(prompt);
	return {
		answer,
		disclaimer: "⚕️ This AI assistant provides information based on your records only and does not constitute medical advice."
	};
}

/**
 * Generate AI Health Insights from latest lab results.
 */
export async function generateHealthInsights(labResults) {
	if (!labResults || labResults.length === 0) {
		return [
			{ icon: "🚶", title: "Stay Active",  tip: "Aim for 30 minutes of walking daily.", urgency: "info" },
			{ icon: "💧", title: "Hydrate",      tip: "Drink at least 8 glasses of water daily.", urgency: "info" },
			{ icon: "😴", title: "Rest Well",    tip: "Maintain 7-8 hours of sleep each night.", urgency: "info" }
		];
	}

	const latestTests = labResults[0]?.structuredData?.slice(0, 10)
		.map(t => `${t.testName}: ${t.value}${t.unit || ""} (${t.flag})`)
		.join("\n") || "";

	const prompt = `You are a preventive health AI.
Based on these latest lab values:
${latestTests}

Generate 3 short, personalized health tips in JSON only:
{
  "insights": [
    { "icon": "emoji", "title": "short title", "tip": "actionable 1-sentence tip", "urgency": "info|warning|critical" }
  ]
}
Focus on lifestyle changes, not medications.`;

	try {
		const text   = await generate(prompt);
		const parsed = safeJson(text, null);
		if (parsed?.insights?.length) return parsed.insights;
	} catch {}

	return [
		{ icon: "💡", title: "Stay Active", tip: "Regular exercise helps maintain overall health.", urgency: "info" }
	];
}

/**
 * Generate a pre-consultation patient briefing summary.
 */
export async function generatePatientBriefingSummary({ patientName, reason, prescriptions, labResults, transcripts }) {
	const rxSummary = prescriptions.slice(0, 5).map((p, i) =>
		`${i + 1}. Prescribed on ${p.createdAt?.toISOString?.().split("T")[0] || "unknown"}: ` +
		p.medicines.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join(", ")
	).join("\n") || "No prescriptions on record.";

	const labSummary = labResults.slice(0, 5).map((l, i) =>
		`${i + 1}. ${l.fileName} (${l.recordDate?.toISOString?.().split("T")[0] || "unknown"}): ` +
		l.structuredData.slice(0, 6).map(t => `${t.testName}=${t.value}${t.unit || ""} [${t.flag}]`).join(", ")
	).join("\n") || "No lab results on record.";

	const transcriptSummary = transcripts?.slice(0, 3).map((t, i) =>
		`${i + 1}. Session on ${t.createdAt?.toISOString?.().split("T")[0] || "unknown"}: ` +
		(t.summaryAi || t.rawText?.substring(0, 200) || "No summary available")
	).join("\n") || "No previous consultations.";

	const prompt = `You are a clinical AI assistant preparing a structured pre-consultation briefing.

Patient: ${patientName}
Reason for Visit: ${reason || "General consultation"}

RECENT PRESCRIPTIONS:
${rxSummary}

RECENT LAB RESULTS:
${labSummary}

PREVIOUS CONSULTATION NOTES:
${transcriptSummary}

Return ONLY valid JSON (no markdown):
{
  "patientOverview": "2-3 sentence summary of patient health status and reason for visit",
  "riskLevel": "low|moderate|high",
  "conditions": ["known condition 1", "condition 2"],
  "labFindings": [
    { "test": "test name", "value": "value with unit", "flag": "normal|high|low|critical", "note": "brief clinical note" }
  ],
  "prescriptions": [
    { "name": "medication name", "dosage": "dosage", "frequency": "frequency" }
  ],
  "concerns": ["clinical concern 1", "concern 2"],
  "insights": ["clinical insight 1", "insight 2"],
  "discussionPoints": ["suggested discussion point 1", "point 2", "point 3"],
  "editableNotes": ["patient note 1", "note 2"]
}`;

	const text = await generate(prompt);
	const parsed = safeJson(text, {
		patientOverview: text.substring(0, 300),
		riskLevel: "unknown",
		conditions: [],
		labFindings: [],
		prescriptions: [],
		concerns: ["Review current medications", "Discuss recent symptoms"],
		insights: [],
		discussionPoints: ["Review current medications", "Discuss recent symptoms", "Follow up on lab results"],
		editableNotes: []
	});
	return { ...parsed, disclaimer: MEDICAL_DISCLAIMER };
}

/**
 * Generate a post-consultation summary from the meeting transcript.
 */
export async function generatePostConsultationSummary({ transcript, patientName, doctorName, reason }) {
	const prompt = `You are a clinical AI assistant. Analyze this consultation transcript and generate a structured summary.

Patient: ${patientName}
Doctor: ${doctorName}
Reason for Visit: ${reason || "Consultation"}

TRANSCRIPT:
${transcript.substring(0, 4000)}

Generate a post-consultation summary in JSON format only (no markdown):
{
  "meetingSummary": "Concise 3-5 sentence summary",
  "medicines": [
    { "name": "medication name", "dosage": "dosage", "frequency": "how often", "duration": "how long" }
  ],
  "keyDecisions": ["decision 1", "decision 2"],
  "diagnosis": "primary diagnosis",
  "followUp": "follow-up instructions"
}`;

	const text = await generate(prompt);
	return safeJson(text, {
		meetingSummary: text.substring(0, 500), medicines: [],
		keyDecisions: [], diagnosis: "See transcript", followUp: "Consult your doctor"
	});
}
