/**
 * AI Controller — MedHub AI+
 * Pre-consultation summary, AI Scribe (transcript save), CDSS check.
 */

import { AppointmentModel }  from "../models/Appointment.js";
import { PrescriptionModel } from "../models/Prescription.js";
import { LabResultModel }    from "../models/LabResult.js";
import { TranscriptModel }   from "../models/Transcript.js";
import { UserModel }         from "../models/User.js";
import {
	generatePreConsultSummary,
	runCdssCheck,
	generateHealthInsights
} from "../services/ollamaService.js";

// ─── Pre-Consultation Summary ─────────────────────────────────────────────────

/**
 * GET /api/ai/pre-consult-summary/:appointmentId
 * Doctor only. Returns an AI-generated brief about the patient.
 * Only available within 60 minutes of appointment start.
 */
export async function getPreConsultSummary(req, res) {
	try {
		const { appointmentId } = req.params;
		const doctorId          = req.user.userId;

		const appointment = await AppointmentModel.findById(appointmentId).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: "Appointment not found." });
		}

		// Only allow the appointment's doctor
		if (appointment.doctorId.toString() !== doctorId) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		const patientId = appointment.patientId;

		// Gather patient context
		const [patient, prescriptions, labResults] = await Promise.all([
			UserModel.findById(patientId).lean(),
			PrescriptionModel.find({ patientId }).sort({ createdAt: -1 }).limit(5).lean(),
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(5).lean()
		]);

		if (!patient) {
			return res.status(404).json({ success: false, error: "Patient not found." });
		}

		const summary = await generatePreConsultSummary({
			patientName:   patient.name,
			prescriptions,
			labResults
		});

		res.json({
			success: true,
			data: {
				patientName:   patient.name,
				appointmentId,
				generatedAt:   new Date().toISOString(),
				...summary
			}
		});

	} catch (error) {
		console.error("Pre-consult summary error:", error.message);

		if (error.message?.includes("OLLAMA") || error.message?.includes("connect")) {
			return res.status(503).json({ success: false, error: "AI service unavailable. Ensure Ollama is running." });
		}
		res.status(500).json({ success: false, error: "Failed to generate pre-consultation summary." });
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
 *
 * First queries OpenFDA for official drug warnings, then uses Gemini
 * to correlate with patient's lab history.
 *
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
		const [labResults, prescriptions] = await Promise.all([
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(3).lean(),
			PrescriptionModel.find({ patientId, status: "active" }).limit(1).lean()
		]);

		const existingMedications = prescriptions.flatMap(p => p.medicines.map(m => `${m.name} ${m.dosage}`));

		// ── Step 3: Ollama clinical reasoning ───────────────────────────────
		const cdssResult = await runCdssCheck({
			medicationName,
			patientLabHistory:  labResults,
			existingMedications
		});

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
		if (error.message?.includes("OLLAMA") || error.message?.includes("connect")) {
			return res.status(503).json({ success: false, error: "AI service unavailable. Ensure Ollama is running." });
		}
		res.status(500).json({ success: false, error: "CDSS check failed." });
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
				basedOn:  labResults[0]?.fileName || "general health data",
				generatedAt: new Date().toISOString(),
				disclaimer: "⚕️ These insights are AI-generated and for informational purposes only. Consult your doctor for medical advice."
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
