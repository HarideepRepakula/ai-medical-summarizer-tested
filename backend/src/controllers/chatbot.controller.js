/**
 * Chatbot Controller — MedHub AI+
 * RAG-based chatbot using patient's medical records as context.
 * Escalation pathway to Doctor dashboard.
 */

import { TranscriptModel }    from "../models/Transcript.js";
import { LabResultModel }     from "../models/LabResult.js";
import { PrescriptionModel }  from "../models/Prescription.js";
import { AppointmentModel }   from "../models/Appointment.js";
import { generateChatbotResponse } from "../services/ollamaService.js";
import { notifyEmergencyEscalation } from "../services/notificationService.js";

// ─── Ask Chatbot ──────────────────────────────────────────────────────────────

/**
 * POST /api/chatbot/ask
 * RAG chatbot: retrieves patient's medical history + transcripts as context,
 * then sends to Gemini for a grounded response.
 *
 * Body: { message }
 */
export async function askChatbot(req, res) {
	try {
		const { message } = req.body;
		const patientId   = req.user.userId;

		if (!message?.trim()) {
			return res.status(400).json({ success: false, error: "Message is required." });
		}

		// ── Build RAG Context ────────────────────────────────────────────────
		const [transcripts, labResults, prescriptions] = await Promise.all([
			TranscriptModel.find({ patientId }).sort({ createdAt: -1 }).limit(3).lean(),
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(3).lean(),
			PrescriptionModel.find({ patientId, status: "active" }).sort({ createdAt: -1 }).limit(3).lean()
		]);

		let context = "";

		// Transcripts
		if (transcripts.length > 0) {
			context += "=== CONSULTATION TRANSCRIPTS ===\n";
			transcripts.forEach((t, i) => {
				context += `--- Session ${i + 1} (${t.createdAt?.toISOString().split("T")[0]}) ---\n`;
				context += t.rawText?.substring(0, 600) + "\n\n";
			});
		}

		// Lab Results
		if (labResults.length > 0) {
			context += "=== RECENT LAB RESULTS ===\n";
			labResults.forEach((lr, i) => {
				context += `--- Report ${i + 1}: ${lr.fileName} (${lr.recordDate?.toISOString().split("T")[0]}) ---\n`;
				lr.structuredData.slice(0, 10).forEach(t =>
					context += `  ${t.testName}: ${t.value}${t.unit || ""} [${t.flag}]\n`
				);
				context += "\n";
			});
		}

		// Prescriptions
		if (prescriptions.length > 0) {
			context += "=== ACTIVE PRESCRIPTIONS ===\n";
			prescriptions.forEach((p, i) => {
				context += `--- Prescription ${i + 1} (${p.createdAt?.toISOString().split("T")[0]}) ---\n`;
				p.medicines.forEach(m =>
					context += `  ${m.name} ${m.dosage} – ${m.frequency}\n`
				);
				context += "\n";
			});
		}

		if (!context) {
			return res.json({
				success: true,
				data: {
					answer:     "I don't have any medical records on file for you yet. Please upload a lab report or complete a consultation first.",
					disclaimer: "⚕️ This AI assistant is for informational purposes only. Always consult your doctor."
				}
			});
		}

		// ── Generate Response ────────────────────────────────────────────────
		const response = await generateChatbotResponse({
			userMessage: message,
			context
		});

		res.json({ success: true, data: response });

	} catch (error) {
		console.error("Chatbot ask error:", error.message);

		if (error.message?.includes("GEMINI_API_KEY")) {
			return res.status(503).json({ success: false, error: "AI service not configured." });
		}

		res.status(500).json({ success: false, error: "Chatbot unavailable. Please try again." });
	}
}

// ─── Escalate to Doctor ───────────────────────────────────────────────────────

/**
 * POST /api/chatbot/escalate
 * Patient flags an emergency from the chatbot.
 * Sets emergencyEscalated on the patient's most recent appointment.
 * Sends an in-app notification to the doctor.
 *
 * Body: { appointmentId? } — optional, uses most recent if not provided
 */
export async function escalateToDoctor(req, res) {
	try {
		const patientId     = req.user.userId;
		const { appointmentId, question } = req.body;

		// Find the appointment to escalate
		let appointment;
		if (appointmentId) {
			appointment = await AppointmentModel.findById(appointmentId);
		} else {
			appointment = await AppointmentModel.findOne({
				patientId,
				status: { $in: ["pending", "confirmed", "in_progress"] }
			}).sort({ appointmentDate: -1 });
		}

		if (!appointment) {
			return res.status(404).json({
				success: false,
				error: "No active appointment found. Please contact the clinic directly."
			});
		}

		// Save the escalated query to PatientQuery collection
		const { PatientQueryModel } = await import('../models/PatientQuery.js');
		const savedQuery = await PatientQueryModel.create({
			appointmentId: appointment._id,
			patientId,
			doctorId:    appointment.doctorId,
			question:    question?.trim() || 'Patient escalated a query from the AI chatbot.',
			status:      'pending',
			escalatedAt: new Date()
		});

		// Mark emergency escalation on appointment
		appointment.emergencyEscalated   = true;
		appointment.emergencyEscalatedAt = new Date();
		await appointment.save();

		// Notify doctor
		await appointment.populate({ path: "patientId", select: "name" });
		const patientName = appointment.patientId?.name || "A patient";

		await notifyEmergencyEscalation(
			appointment.doctorId.toString(),
			patientName,
			appointment._id
		);

		console.log(`[CHATBOT] Query escalated: patient ${patientId} → doctor ${appointment.doctorId}`);

		res.json({
			success: true,
			message: "Your doctor has been notified and will contact you shortly.",
			data: {
				appointmentId:  appointment._id,
				queryId:        savedQuery._id,
				escalatedAt:    savedQuery.escalatedAt,
				doctorNotified: true
			}
		});

	} catch (error) {
		console.error("Escalate error:", error.message);
		res.status(500).json({ success: false, error: "Failed to send emergency escalation." });
	}
}

// ─── Consultation-Scoped Chatbot ─────────────────────────────────────────────

/**
 * POST /api/chatbot/ask-consultation
 * RAG chatbot scoped to a specific consultation's records.
 * Context: consultation transcript + meeting summary + patient historical records.
 *
 * Body: { message, appointmentId }
 */
export async function askConsultationChatbot(req, res) {
	try {
		const { message, appointmentId } = req.body;
		const patientId = req.user.userId;

		if (!message?.trim()) {
			return res.status(400).json({ success: false, error: "Message is required." });
		}

		if (!appointmentId) {
			return res.status(400).json({ success: false, error: "appointmentId is required." });
		}

		// Fetch the specific appointment
		const appointment = await AppointmentModel.findById(appointmentId).lean();
		if (!appointment) {
			return res.status(404).json({ success: false, error: "Appointment not found." });
		}

		// Auth: must be the patient
		if (appointment.patientId.toString() !== patientId) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		// ── Build Scoped RAG Context ──────────────────────────────────────────
		let context = "";

		// 1. This consultation's transcript
		const transcript = await TranscriptModel.findOne({ appointmentId }).lean();
		if (transcript?.rawText) {
			context += "=== THIS CONSULTATION TRANSCRIPT ===\n";
			context += transcript.rawText.substring(0, 1500) + "\n\n";
		}

		// 2. This consultation's AI summary
		if (transcript?.summaryAi) {
			context += "=== MEETING SUMMARY ===\n";
			context += transcript.summaryAi.substring(0, 800) + "\n\n";
		}

		// 3. Pre-consultation AI briefing
		if (appointment.aiPreparedSummary?.content) {
			context += "=== PRE-CONSULTATION BRIEFING ===\n";
			context += appointment.aiPreparedSummary.content.substring(0, 800) + "\n\n";
		}

		// 4. Medicines from this consultation
		if (appointment.consultationRecords?.medicines?.length > 0) {
			context += "=== PRESCRIBED MEDICINES ===\n";
			appointment.consultationRecords.medicines.forEach(m => {
				context += `- ${m.name} ${m.dosage} – ${m.frequency} (${m.duration || 'as directed'})\n`;
			});
			context += "\n";
		}

		// 5. Patient's broader medical history
		const [labResults, prescriptions] = await Promise.all([
			LabResultModel.find({ patientId }).sort({ recordDate: -1 }).limit(2).lean(),
			PrescriptionModel.find({ patientId, status: "active" }).sort({ createdAt: -1 }).limit(2).lean()
		]);

		if (labResults.length > 0) {
			context += "=== PATIENT LAB HISTORY ===\n";
			labResults.forEach(lr => {
				context += `--- ${lr.fileName} (${lr.recordDate?.toISOString().split("T")[0]}) ---\n`;
				lr.structuredData.slice(0, 6).forEach(t =>
					context += `  ${t.testName}: ${t.value}${t.unit || ""} [${t.flag}]\n`
				);
			});
			context += "\n";
		}

		if (prescriptions.length > 0) {
			context += "=== OTHER ACTIVE PRESCRIPTIONS ===\n";
			prescriptions.forEach(p => {
				p.medicines.forEach(m =>
					context += `  ${m.name} ${m.dosage} – ${m.frequency}\n`
				);
			});
		}

		if (!context) {
			return res.json({
				success: true,
				data: {
					answer: "I don't have any records for this consultation yet. If the meeting has ended, the records may still be processing.",
					disclaimer: "⚕️ This AI assistant is for informational purposes only."
				}
			});
		}

		// ── Generate Response ────────────────────────────────────────────────
		const response = await generateChatbotResponse({
			userMessage: message,
			context
		});

		res.json({ success: true, data: response });

	} catch (error) {
		console.error("Consultation chatbot error:", error.message);

		if (error.message?.includes("GEMINI_API_KEY")) {
			return res.status(503).json({ success: false, error: "AI service not configured." });
		}

		res.status(500).json({ success: false, error: "Chatbot unavailable. Please try again." });
	}
}
