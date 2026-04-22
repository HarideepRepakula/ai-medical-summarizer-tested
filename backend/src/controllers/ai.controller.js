/**
 * AI Controller — ClinIQ AI+
 * Pre-consultation summary, AI Scribe (transcript save), CDSS check.
 *
 * NOTE: Facebook BART Python bridge has been fully removed.
 *       All summarization now uses Ollama (summarizeMedicalDocument / generatePatientBriefingSummary).
 */

import mongoose from "mongoose";
import { AppointmentModel }  from "../models/Appointment.js";
import { PrescriptionModel } from "../models/Prescription.js";
import { LabResultModel }    from "../models/LabResult.js";
import { TranscriptModel }   from "../models/Transcript.js";
import { UserModel }         from "../models/User.js";
import {
	runCdssCheck,
	generateHealthInsights,
	summarizeMedicalDocument,
	generatePatientBriefingSummary
} from "../services/ollamaService.js";

// ─── Pre-Consultation Summary ─────────────────────────────────────────────────

/**
 * GET /api/ai/pre-consult-summary/:appointmentId
 * Doctor only. Returns an AI-generated clinical brief about the patient.
 * Uses Ollama generatePatientBriefingSummary() — replaces the old BART bridge.
 */
export async function getPreConsultSummary(req, res) {
	try {
		const { appointmentId } = req.params;
		const doctorId          = req.user.userId;

		const appointment = await AppointmentModel.findById(appointmentId)
			.populate('patientId', 'name email')
			.lean();

		if (!appointment) {
			return res.status(404).json({ success: false, error: "Appointment not found." });
		}
		if (appointment.doctorId.toString() !== doctorId) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		// Return cached summary if already generated
		if (appointment.aiPreparedSummary?.content) {
			return res.json({
				success: true,
				data: {
					patientName:   appointment.patientId?.name || 'Unknown',
					appointmentId,
					summary:       appointment.aiPreparedSummary.content,
					generatedAt:   appointment.aiPreparedSummary.generatedAt,
					cached:        true
				}
			});
		}

		const patientId = appointment.patientId._id || appointment.patientId;

		const [prescriptions, labResults, transcripts] = await Promise.all([
			PrescriptionModel.find({ patientId }).sort({ createdAt: -1 }).limit(5).lean(),
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(5).lean(),
			TranscriptModel.find({ patientId }).sort({ createdAt: -1 }).limit(3).lean()
		]);

		const patient = await UserModel.findById(patientId).lean();
		if (!patient) {
			return res.status(404).json({ success: false, error: "Patient not found." });
		}

		console.log('[AI] Generating pre-consult summary via Ollama...');
		const briefing = await generatePatientBriefingSummary({
			patientName:   patient.name,
			reason:        appointment.reason,
			prescriptions,
			labResults,
			transcripts
		});
		console.log('[AI] Pre-consult summary generated.');

		const summaryContent = briefing.patientOverview || briefing.summary || 'Summary generated.';

		// Cache to DB
		await AppointmentModel.findByIdAndUpdate(appointmentId, {
			$set: {
				'aiPreparedSummary.content':     summaryContent,
				'aiPreparedSummary.generatedAt': new Date(),
				'aiPreparedSummary.isLocked':    false
			}
		});

		res.json({
			success: true,
			data: {
				patientName:    patient.name,
				appointmentId,
				summary:        summaryContent,
				riskLevel:      briefing.riskLevel,
				conditions:     briefing.conditions     || [],
				concerns:       briefing.concerns       || [],
				labFindings:    briefing.labFindings    || [],
				discussionPoints: briefing.discussionPoints || [],
				generatedAt:    new Date().toISOString(),
				cached:         false
			}
		});

	} catch (error) {
		console.error("Pre-consult summary error:", error.message);
		res.status(500).json({
			success: false,
			error: "AI summary failed. Ensure Ollama is running: ollama serve"
		});
	}
}

// ─── Save Transcript ──────────────────────────────────────────────────────────

/**
 * POST /api/ai/save-transcript
 * Saves the AI scribe transcript to MongoDB.
 * Body: { appointmentId, rawText, segments, durationSeconds }
 */
export async function saveTranscript(req, res) {
	try {
		const { appointmentId, rawText, segments = [], durationSeconds } = req.body;
		const userId = req.user.userId;

		if (!appointmentId || !rawText) {
			return res.status(400).json({ success: false, error: "appointmentId and rawText are required." });
		}

		const appointment = await AppointmentModel.findById(appointmentId).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: "Appointment not found." });
		}

		// Must be doctor or patient
		const isAuthorized = [
			appointment.doctorId.toString(),
			appointment.patientId.toString()
		].includes(userId);

		if (!isAuthorized) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		// Upsert (one transcript per appointment)
		const transcript = await TranscriptModel.findOneAndUpdate(
			{ appointmentId },
			{
				$set: {
					patientId: appointment.patientId,
					doctorId:  appointment.doctorId,
					rawText,
					segments,
					durationSeconds: durationSeconds || 0
				}
			},
			{ upsert: true, new: true }
		);

		res.json({
			success: true,
			message: "Transcript saved successfully.",
			data: {
				transcriptId:    transcript._id,
				appointmentId,
				wordsApprox:     rawText.split(" ").length,
				savedAt:         transcript.updatedAt
			}
		});

	} catch (error) {
		console.error("Save transcript error:", error.message);
		res.status(500).json({ success: false, error: "Failed to save transcript." });
	}
}

// ─── CDSS Drug Interaction Check ─────────────────────────────────────────────

/**
 * POST /api/ai/cdss-check
 * Runs a clinical decision support check for a medication.
 * First queries OpenFDA for official drug warnings, then uses Ollama
 * to correlate with patient's lab history.
 * Body: { medicationName, patientId }
 */
export async function cdssCheck(req, res) {
	try {
		const { medicationName, patientId } = req.body;

		if (!medicationName || !patientId) {
			return res.status(400).json({ success: false, error: "medicationName and patientId are required." });
		}

		// ── Step 1: OpenFDA drug label lookup (free, no key) ─────────────────
		let fdaWarnings = [];
		try {
			const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(medicationName)}"&limit=1`;
			const fdaRes = await fetch(fdaUrl);
			if (fdaRes.ok) {
				const fdaData = await fdaRes.json();
				const label   = fdaData.results?.[0];
				if (label) {
					fdaWarnings = [
						...(label.warnings           || []).slice(0, 2),
						...(label.contraindications  || []).slice(0, 2),
						...(label.drug_interactions  || []).slice(0, 2)
					].filter(Boolean);
				}
			}
		} catch (fdaErr) {
			console.warn("[CDSS] OpenFDA lookup failed:", fdaErr.message);
		}

		// ── Step 2: Patient context ───────────────────────────────────────────
		const isValidId = mongoose.Types.ObjectId.isValid(patientId) && patientId.length === 24;
		const [labResults, prescriptions] = isValidId
			? await Promise.all([
				LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(3).lean(),
				PrescriptionModel.find({ patientId, status: "active" }).limit(1).lean()
			])
			: [[], []];

		const existingMedications = prescriptions.flatMap(p =>
			p.medicines.map(m => `${m.name} ${m.dosage}`)
		);

		// ── Step 3: Ollama clinical reasoning (with graceful fallback) ────────
		let cdssResult;
		try {
			cdssResult = await runCdssCheck({
				medicationName,
				patientLabHistory:  labResults,
				existingMedications
			});
		} catch (aiErr) {
			console.warn("[CDSS] Ollama unavailable, using FDA-only fallback:", aiErr.message);
			cdssResult = {
				riskLevel:         fdaWarnings.length > 0 ? "caution" : "safe",
				interactions:      [],
				contraindications: [],
				labConcerns:       [],
				recommendation:    fdaWarnings.length > 0
					? `FDA data found for ${medicationName}. Review warnings below before prescribing.`
					: `No FDA warnings found for "${medicationName}". Verify the drug name and consult clinical references.`,
				requiresAttention: fdaWarnings.length > 0,
				aiNote:            "⚠️ AI analysis unavailable (Ollama offline). Showing FDA data only."
			};
		}

		res.json({
			success: true,
			data: {
				medication:  medicationName,
				fdaWarnings: fdaWarnings.slice(0, 3),
				...cdssResult,
				checkedAt:   new Date().toISOString()
			}
		});

	} catch (error) {
		console.error("CDSS check error:", error.message);
		res.status(500).json({ success: false, error: "CDSS check failed: " + error.message });
	}
}

// ─── AI Health Insights ───────────────────────────────────────────────────────

/**
 * GET /api/ai/health-insights
 * Patient only. Returns personalized health tips from latest lab data.
 */
export async function getHealthInsights(req, res) {
	try {
		const patientId = req.user.userId;

		const labResults = await LabResultModel.find({ patientId })
			.sort({ recordDate: -1 })
			.limit(2)
			.lean();

		const insights = await generateHealthInsights(labResults);

		res.json({
			success: true,
			data: {
				insights,
				basedOn:     labResults[0]?.fileName || "general health data",
				generatedAt: new Date().toISOString(),
				disclaimer:  "⚕️ These insights are AI-generated and for informational purposes only. Consult your doctor for medical advice."
			}
		});

	} catch (error) {
		console.error("Health insights error:", error.message);
		// Return default insights if AI fails
		res.json({
			success: true,
			data: {
				insights: [
					{ icon: "🚶", title: "Stay Active", tip: "Aim for 30 minutes of walking daily.", urgency: "info" },
					{ icon: "💧", title: "Hydrate",     tip: "Drink at least 8 glasses of water daily.", urgency: "info" },
					{ icon: "😴", title: "Rest Well",   tip: "Maintain 7-8 hours of sleep each night.", urgency: "info" }
				],
				disclaimer: "⚕️ General health tips. Add your lab records for personalized insights."
			}
		});
	}
}

// ─── Ollama Medical Summarizer (replaces /api/ai/bart-summary) ───────────────

/**
 * POST /api/ai/summarize
 * Runs Ollama medical summarization (replaces old BART endpoint).
 * Body: { text, fileName? }
 *
 * Also kept as /api/ai/bart-summary for backward compatibility with any
 * frontend code that still calls the old endpoint name.
 */
export async function getMedicalSummary(req, res) {
	const { text, fileName = 'Medical Document' } = req.body;
	if (!text?.trim()) {
		return res.status(400).json({ success: false, error: "text is required." });
	}
	try {
		const result = await summarizeMedicalDocument(text, fileName);
		res.json({
			success:       true,
			summary:       result.summary,
			extractedMeds: result.extracted_meds || [],
			clinicalFlags: result.clinicalFlags  || [],
			severityFlag:  result.severityFlag   || 'none',
			engine:        'ollama'
		});
	} catch (err) {
		console.error("[AI] getMedicalSummary error:", err.message);
		res.status(500).json({
			success: false,
			error:   "AI summarizer failed. Ensure Ollama is running: ollama serve"
		});
	}
}

// Backward-compatible alias for old BART endpoint
export const getBartSummary = getMedicalSummary;
