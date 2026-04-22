/**
 * AI Service — ClinIQ AI+
 * Uses Ollama (local LLM) for ALL AI features including medical summarization.
 * Model: llama3.2 (fully local, no API key, no rate limits)
 *
 * Setup:
 *   1. Install Ollama: https://ollama.com
 *   2. Run: ollama pull llama3.2
 *   3. Ollama runs on http://localhost:11434 by default
 *
 * NOTE: Facebook BART Python bridge has been fully replaced by Ollama.
 *       summarizeMedicalDocument() replicates BART's clinical extraction behavior.
 */

import { Ollama } from "ollama";

const OLLAMA_MODEL  = process.env.OLLAMA_MODEL  || "llama3.2";
const OLLAMA_HOST   = process.env.OLLAMA_HOST   || "http://localhost:11434";
const OLLAMA_TIMEOUT_MS = 30000; // 30-second timeout for all Ollama calls
const MEDICAL_DISCLAIMER = `\n\n---\n⚕️ **Medical Disclaimer**: This AI-generated content is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare professional for medical decisions.`;

// Singleton client
const client = new Ollama({ host: OLLAMA_HOST });

// ── Core helper with timeout ───────────────────────────────────────────────────

async function generate(prompt) {
	const controller = new AbortController();
	const timeoutId  = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

	try {
		const response = await client.generate({
			model:  OLLAMA_MODEL,
			prompt,
			stream: false,
			options: { temperature: 0.2, num_predict: 1024 }
		});
		clearTimeout(timeoutId);
		return response.response.trim();
	} catch (err) {
		clearTimeout(timeoutId);
		if (err.name === 'AbortError' || err.message?.includes('abort')) {
			throw new Error(`[OLLAMA] Request timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. Ensure Ollama is running: ollama serve`);
		}
		throw err;
	}
}

function safeJson(text, fallback) {
	try {
		// Step 1: Remove markdown code fences
		let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

		// Step 2: Extract only the JSON object between first { and last }
		const start = cleaned.indexOf('{');
		const end   = cleaned.lastIndexOf('}');

		if (start === -1 || end === -1) {
			console.error("[OLLAMA] No JSON object found in response");
			return fallback;
		}

		return JSON.parse(cleaned.substring(start, end + 1));
	} catch (err) {
		console.error("[OLLAMA] Parsing failed. Raw snippet:", text.substring(0, 100));
		return fallback;
	}
}

// ── NEW: Medical Document Summarizer (replaces Facebook BART) ─────────────────

/**
 * summarizeMedicalDocument()
 * Fully replaces the BART Python bridge.
 * Replicates BART's two-pass clinical extraction:
 *   Pass 1 → Extract clinical values, flag abnormals (Hemoglobin, HbA1c, Glucose, etc.)
 *   Pass 2 → Generate abstractive clinical summary + extract medication names
 *
 * Called from:
 *   - medicalRecords.controller.js (background AI summary after upload)
 *   - ai.controller.js (getPreConsultSummary, getBartSummary)
 */
export async function summarizeMedicalDocument(ocrText, fileName = "Medical Document") {
	// Truncate very long documents — Ollama context window is ~4096 tokens
	const truncatedText = ocrText.substring(0, 4000);

	const prompt = `You are a clinical AI assistant analyzing a medical document for a healthcare platform.

Document Name: "${fileName}"
Document Content:
---
${truncatedText}
---

Perform a two-pass clinical analysis:

PASS 1 — Extract and flag all laboratory values:
- Look for test names paired with numeric values and units (e.g. "Hemoglobin 9.2 g/dL")
- Flag as HIGH, LOW, or Normal based on standard reference ranges:
  * Hemoglobin: Normal 12.0–17.5 g/dL
  * HbA1c: Normal 4.0–5.6%, Pre-diabetic 5.7–6.4%, Diabetic >6.5%
  * Glucose (fasting): Normal 70–100 mg/dL
  * TSH: Normal 0.4–4.0 mIU/L
  * Creatinine: Normal 0.6–1.2 mg/dL
  * eGFR: Normal >60 mL/min
  * Triglycerides: Normal <150 mg/dL
  * Total Cholesterol: Normal <200 mg/dL

PASS 2 — Generate clinical summary and extract medications.

Return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "2-4 sentence professional clinical summary. Start with 'Clinical Flags: [value] [HIGH/LOW]; ...' if abnormals exist, then summarize the overall findings.",
  "clinicalFlags": ["Hemoglobin: 9.2 g/dL [LOW]", "HbA1c: 7.1% [HIGH — Diabetic range]"],
  "extracted_meds": ["Metformin", "Atorvastatin"],
  "severityFlag": "none|mild|moderate|urgent",
  "keyFindings": ["finding 1", "finding 2"]
}

RULES:
1. extracted_meds: list ONLY medication names found in the document text. Empty array if none.
2. severityFlag "urgent" if any critical value found (e.g. HbA1c > 9, Hemoglobin < 8, Glucose > 400).
3. If no lab values found, set clinicalFlags to [] and write a general document summary.
4. Keep the summary professional and concise — suitable for a doctor to read in 10 seconds.`;

	try {
		const text   = await generate(prompt);
		const parsed = safeJson(text, null);

		if (parsed?.summary) {
			// Build BART-compatible output: prepend flags to summary (as BART did)
			let finalSummary = parsed.summary;
			if (parsed.clinicalFlags?.length > 0 && !finalSummary.includes('Clinical Flags')) {
				finalSummary = `Clinical Flags: ${parsed.clinicalFlags.join('; ')}\n\n${finalSummary}`;
			}
			return {
				summary:        finalSummary,
				extracted_meds: parsed.extracted_meds || [],
				clinicalFlags:  parsed.clinicalFlags  || [],
				severityFlag:   parsed.severityFlag   || 'none',
				keyFindings:    parsed.keyFindings    || []
			};
		}

		// Fallback: treat raw text as summary
		return {
			summary:        text.substring(0, 500),
			extracted_meds: [],
			clinicalFlags:  [],
			severityFlag:   'none',
			keyFindings:    []
		};
	} catch (err) {
		console.error('[OLLAMA] summarizeMedicalDocument failed:', err.message);
		// Return a meaningful fallback so UI never shows "Generating..." permanently
		return {
			summary:        `Document "${fileName}" processed. AI analysis temporarily unavailable — please try refreshing. (${err.message})`,
			extracted_meds: [],
			clinicalFlags:  [],
			severityFlag:   'none',
			keyFindings:    []
		};
	}
}

/**
 * extractMedicationsFromText()
 * Replaces the BART med-extraction step for external prescription uploads.
 * Takes raw OCR text from an uploaded prescription image and returns medication names.
 */
export async function extractMedicationsFromText(text) {
	const prompt = `You are a pharmacist reading a prescription. Extract ALL medication names from this text.

PRESCRIPTION TEXT:
---
${text.substring(0, 2000)}
---

Return ONLY a JSON array of medication names. Include brand names and generic names as written.
Examples: ["Paracetamol 500mg", "Tab Amoxicillin 250mg", "Dolo 650", "Metformin 500mg BD"]

If no medications found, return: []`;

	try {
		const raw  = await generate(prompt);
		// Handle both array and object responses
		const arrMatch = raw.match(/\[.*?\]/s);
		if (arrMatch) {
			return JSON.parse(arrMatch[0]);
		}
		return [];
	} catch (err) {
		console.error('[OLLAMA] extractMedicationsFromText failed:', err.message);
		return [];
	}
}

// ── Existing exported functions (unchanged signatures) ────────────────────────

/**
 * Generate a natural-remedies-focused medical record summary.
 * Runs in background after upload — result cached in MedicalRecord.aiSummary.
 */
export async function generateMedicalRecordSummary(ocrText, fileName) {
	const prompt = `You are a holistic health assistant analyzing a medical document.
Document: "${fileName}"
Content: ${ocrText.substring(0, 3000)}

Provide a structured analysis in JSON only (no markdown):
{
  "summary": "2-3 sentence plain-language summary of what this document shows",
  "keyFindings": ["finding 1", "finding 2"],
  "naturalRemedies": [
    "Specific dietary change or natural remedy (e.g., increase leafy greens for low iron)",
    "Lifestyle recommendation (e.g., 30-min daily walk for elevated glucose)",
    "Herbal or nutritional suggestion (e.g., turmeric tea for inflammation markers)"
  ],
  "severityFlag": "none|mild|moderate|urgent",
  "flagReason": "If urgent or moderate, explain why doctor consultation is needed. Otherwise empty string."
}

STRICT RULES:
1. Do NOT recommend any pharmaceutical drugs, medications, or chemical compounds.
2. Only suggest natural remedies: diet, herbs, lifestyle, sleep, hydration, exercise.
3. If any value is critically abnormal, set severityFlag to "urgent" and flagReason to explain.
4. Keep naturalRemedies practical and specific to the findings.`;

	const text = await generate(prompt);
	return safeJson(text, {
		summary: 'Summary generation in progress.',
		keyFindings: [],
		naturalRemedies: ['Stay hydrated', 'Maintain a balanced diet', 'Get regular exercise'],
		severityFlag: 'none',
		flagReason: ''
	});
}

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
		(l.structuredData || []).slice(0, 6).map(t => `${t.testName}=${t.value}${t.unit || ""}`).join(", ")
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
		(l.structuredData || []).slice(0, 8).map(t => `${t.testName}: ${t.value}${t.unit || ""} (${t.flag})`)
	).join(", ") || "No lab data available";

	const meds = existingMedications.slice(0, 8).join(", ") || "None";

	const prompt = `You are a Clinical Decision Support System (CDSS) for a hospital.
A doctor is about to prescribe: "${medicationName}"

Patient's current medications: ${meds}
Patient's recent lab values: ${labContext}

Classification rules:
- "contraindicated" = absolute contraindications exist (patient MUST NOT take this drug)
- "warning" = serious drug interactions or warnings exist but no absolute contraindications
- "caution" = minor interactions or general precautions only
- "safe" = no significant risks found for standard use

Formatting rules:
- Do NOT include FDA section numbers like "(4)", "(6)", "[See Section X]"
- Do NOT say "See Table 1" or "Table 2" — instead summarize what those tables contain
- Keep each item to 1-2 clear sentences maximum
- Strip parenthetical cross-references like "(e.g., anaphylaxis) [See Adverse Reactions (6)]"

Return ONLY valid JSON:
{
  "riskLevel": "safe|caution|warning|contraindicated",
  "interactions": ["clean interaction summary without table references"],
  "contraindications": ["clean contraindication without section numbers"],
  "labConcerns": ["concern based on lab values"],
  "recommendation": "one sentence actionable advice for the doctor",
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
 * Hybrid AI Assistant:
 * Uses personal records for context but falls back to general medical knowledge.
 */
export async function generateChatbotResponse({ userMessage, context }) {
	const hasRecords = context && context.length > 50 && context !== 'No history available.';

	const prompt = `You are ClinIQ AI, a professional and empathetic clinical health assistant.

PATIENT HISTORY:
${hasRecords ? context.substring(0, 3000) : 'No previous medical records found for this patient.'}

USER QUESTION: "${userMessage}"

GOAL:
- If the answer is in the PATIENT HISTORY above, use it to give a personalised response.
- If the PATIENT HISTORY is empty or does not contain the answer, use your general medical knowledge.
- For symptoms like headache or stomach pain, suggest possible causes, home remedies, and which specialist to see.
- For emergencies like chest pain or difficulty breathing, advise calling emergency services immediately.
- Always end with a Possible Next Steps section.

RULES:
1. Be concise, empathetic, and use bullet points for readability.
2. Never give a definitive diagnosis or specific drug dosages.
3. Always recommend consulting a doctor for final decisions.
4. Keep response under 200 words.`;

	const answer = await generate(prompt);
	return {
		answer,
		disclaimer: '⚕️ AI-generated guidance. Consult a doctor for medical decisions.'
	};
}

/**
 * Fuzzy-map prescription medicine names to actual inventory product names.
 * Handles brand→generic, typos, and partial names.
 * Falls back to regex matching if Ollama is offline.
 */
export async function mapMedsToInventory(extractedNames, storeProducts) {
	if (!extractedNames.length || !storeProducts.length) return [];

	const storeNames = storeProducts.map(p => p.name).join(", ");
	const prompt = `You are a pharmacist. A prescription contains: [${extractedNames.join(", ")}].
Our store has: [${storeNames}].
Match each prescription item to the closest store product (brand=generic is fine, e.g. Dolo=Paracetamol).
Return ONLY a JSON array of matched store names, no explanation.
Example: ["Paracetamol 500mg", "Amoxicillin 250mg"]`;

	try {
		const raw = await generate(prompt);
		// Fix: use /s flag so . matches newlines in multi-line JSON arrays
		const match = raw.match(/\[.*?\]/s);
		if (match) {
			const names = JSON.parse(match[0]);
			return storeProducts.filter(p => names.some(n =>
				p.name.toLowerCase().includes(n.toLowerCase()) ||
				n.toLowerCase().includes(p.name.toLowerCase())
			));
		}
	} catch {
		console.warn('[OLLAMA] Fuzzy mapping failed, falling back to regex');
	}

	// Regex fallback: partial name match
	return storeProducts.filter(p =>
		extractedNames.some(n =>
			p.name.toLowerCase().includes(n.toLowerCase()) ||
			n.toLowerCase().includes(p.name.toLowerCase()) ||
			(p.genericName && p.genericName.toLowerCase().includes(n.toLowerCase()))
		)
	);
}

export async function generateHealthInsights(labResults) {
	if (!labResults || labResults.length === 0) {
		return [
			{ icon: "🚶", title: "Stay Active",  tip: "Aim for 30 minutes of walking daily.", urgency: "info" },
			{ icon: "💧", title: "Hydrate",      tip: "Drink at least 8 glasses of water daily.", urgency: "info" },
			{ icon: "😴", title: "Rest Well",    tip: "Maintain 7-8 hours of sleep each night.", urgency: "info" }
		];
	}

	const latestTests = (labResults[0]?.structuredData || []).slice(0, 10)
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
		(l.structuredData || []).slice(0, 6).map(t => `${t.testName}=${t.value}${t.unit || ""} [${t.flag}]`).join(", ")
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

// ── AI Admin Functions ────────────────────────────────────────────────────────

/**
 * AI Admin: Credential Verification
 * OCR text from doctor's license → LLM decision: approved | rejected
 */
export async function aiAdminVerifyDoctor(doctorData, licenseOcrText) {
	const prompt = `You are the MedHub AI System Administrator.
Your task is to verify if a doctor's registration data matches their uploaded medical license.

REGISTRATION DATA:
- Name: ${doctorData.name}
- Specialty: ${doctorData.specialty}
- Claimed License Number: ${doctorData.licenseNumber || 'Not provided'}

EXTRACTED TEXT FROM LICENSE PHOTO (OCR):
"${licenseOcrText.substring(0, 2000)}"

RULES:
1. The name on the license must closely match the registration name.
2. The license number must appear somewhere in the OCR text (if provided).
3. The document must look like a valid medical license (not a random document).
4. If the license looks fake, expired, or names don't match, REJECT.

Return ONLY valid JSON:
{
  "decision": "approved" | "rejected",
  "confidenceScore": 0-100,
  "reason": "short explanation of your decision",
  "nameMatch": true | false,
  "licenseNumberFound": true | false
}`;

	const text = await generate(prompt);
	return safeJson(text, { decision: "rejected", confidenceScore: 0, reason: "AI Admin verification error — manual review required", nameMatch: false, licenseNumberFound: false });
}

/**
 * AI Admin: System Health Report
 * Analyzes appointments + security logs → generates platform health summary
 */
export async function aiAdminSystemReport({ appointments, recentLogins, flaggedUsers }) {
	const apptSummary  = `Total: ${appointments.total}, Completed: ${appointments.completed}, Cancelled: ${appointments.cancelled}, Pending: ${appointments.pending}`;
	const loginSummary = `Total logins (24h): ${recentLogins.total}, Failed: ${recentLogins.failed}, Locked accounts: ${recentLogins.locked}`;
	const flagSummary  = flaggedUsers.length > 0 ? flaggedUsers.map(u => `${u.email} — ${u.reason}`).join('; ') : 'None';

	const prompt = `You are the MedHub AI System Administrator generating a platform health report.

SYSTEM METRICS (last 24 hours):
- Appointments: ${apptSummary}
- Login Activity: ${loginSummary}
- Flagged Users: ${flagSummary}

Generate a concise system health report in JSON only:
{
  "overallHealth": "healthy|warning|critical",
  "summary": "2-3 sentence platform status overview",
  "securityAlerts": ["alert1", "alert2"],
  "recommendations": ["action1", "action2"],
  "metrics": {
    "appointmentCompletionRate": "percentage string",
    "loginSuccessRate": "percentage string",
    "activeThreats": 0
  }
}`;

	const text = await generate(prompt);
	return safeJson(text, {
		overallHealth: "warning",
		summary: "System report generation failed. Manual review recommended.",
		securityAlerts: [],
		recommendations: ["Check system logs manually"],
		metrics: { appointmentCompletionRate: "N/A", loginSuccessRate: "N/A", activeThreats: 0 }
	});
}

/**
 * AI Admin: Medical Record Content Moderation
 * Flags records that contain non-medical or inappropriate content
 */
export async function aiAdminModerateRecord(recordName, ocrText) {
	const prompt = `You are the MedHub AI Content Moderator.
Review this medical record and determine if it contains legitimate medical content.

Record Name: "${recordName}"
Content Preview: "${ocrText.substring(0, 1000)}"

Return ONLY valid JSON:
{
  "isMedical": true | false,
  "flagged": true | false,
  "reason": "brief explanation",
  "contentType": "lab_report|prescription|scan|non_medical|unknown"
}`;

	const text = await generate(prompt);
	return safeJson(text, { isMedical: true, flagged: false, reason: "Moderation check skipped", contentType: "unknown" });
}
