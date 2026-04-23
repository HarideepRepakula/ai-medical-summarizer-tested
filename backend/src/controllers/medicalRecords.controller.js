/**
 * Medical Records Controller — ClinIQ AI+
 * POST   /api/medical-records/upload        — patient uploads a record
 * GET    /api/medical-records               — patient fetches own records
 * GET    /api/medical-records/patient/:id   — doctor fetches a patient's records
 * DELETE /api/medical-records/:id           — patient deletes a record
 *
 * AI Pipeline (BART REMOVED — now 100% Ollama):
 *   1. File uploaded → Tesseract/pdfplumber extracts raw text
 *   2. Ollama parseLabReportOcr() → structured lab data saved to LabResult
 *   3. Ollama summarizeMedicalDocument() → clinical summary saved to MedicalRecord.aiSummary
 */

import fs from "fs/promises";
import path from "path";
import { extractTextFromFile } from "../utils/fileExtraction.js";
import { MedicalRecordModel } from "../models/MedicalRecord.js";
import { LabResultModel }     from "../models/LabResult.js";
import {
	parseLabReportOcr,
	summarizeMedicalDocument
} from "../services/ollamaService.js";

const UPLOADS_BASE_URL = process.env.UPLOADS_BASE_URL || "http://127.0.0.1:4000/uploads";

// ── Text Extraction (unchanged — Tesseract for images, pdfplumber for PDFs) ──

/**
 * Extract raw text from an uploaded file.
 * PDFs: spawns python -c pdfplumber (text extraction only — no BART summarization)
 * Images: Tesseract OCR
 */
async function extractText(filePath, mimeType) {
	return await extractTextFromFile(filePath, mimeType);
}

// ── Background Processing: OCR → Lab Parse → AI Summary (all via Ollama) ─────

async function processRecordInBackground(filePath, patientId, recordId, fileType, fileName, mimeType) {
	try {
		console.log(`[RECORDS] Starting background processing for: ${fileName}`);
		const ocrText = await extractText(filePath, mimeType);

		if (ocrText.length < 20) {
			console.warn('[RECORDS] Extracted text too short, saving minimal summary for:', fileName);
			await MedicalRecordModel.findByIdAndUpdate(recordId, {
				aiSummary:            `File "${fileName}" uploaded. Our AI could not read any text in this document. If this is a scanned PDF or a photograph inside a PDF, please upload it directly as an image file (JPG or PNG) so our OCR engine can read it.`,
				aiSummaryGeneratedAt: new Date(),
			});
			return;
		}

		console.log(`[RECORDS] Extracted ${ocrText.length} chars from ${fileName}`);

		// ── Step 1: Parse lab data (Ollama) if it's a lab report ─────────────
		if (fileType === "Lab Report") {
			try {
				const structured = await parseLabReportOcr(ocrText);
				await LabResultModel.create({
					patientId,
					medicalRecordId: recordId,
					labName:         structured.labName        || null,
					recordDate:      structured.recordDate ? new Date(structured.recordDate) : new Date(),
					doctorOrdered:   structured.doctorOrdered  || null,
					structuredData:  structured.tests          || [],
					rawText:         ocrText,
					fileName,
				});
				console.log(`[RECORDS] Lab data parsed for record ${recordId}: ${(structured.tests || []).length} tests`);
			} catch (e) {
				console.warn('[RECORDS] Lab parse failed (Ollama):', e.message);
			}
		}

		// ── Step 2: Generate AI clinical summary (Ollama — replaces BART) ────
		try {
			const result = await summarizeMedicalDocument(ocrText, fileName);

			await MedicalRecordModel.findByIdAndUpdate(recordId, {
				aiSummary:            result.summary,
				aiSummaryGeneratedAt: new Date(),
			});
			console.log(`[RECORDS] ✅ Ollama summary saved for record ${recordId} | severity: ${result.severityFlag}`);
		} catch (e) {
			console.warn('[RECORDS] Ollama summary failed:', e.message);
			// Save a graceful fallback — the UI must not show "Generating..." forever
			await MedicalRecordModel.findByIdAndUpdate(recordId, {
				aiSummary:            `Document "${fileName}" (${ocrText.length} characters extracted). AI summary temporarily unavailable — ensure Ollama is running: ollama serve`,
				aiSummaryGeneratedAt: new Date(),
			});
		}
	} catch (err) {
		console.error('[RECORDS] Background processing error:', err.message);
	}
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadMedicalRecord(req, res) {
	if (!req.file) {
		return res.status(400).json({ success: false, error: "No file uploaded." });
	}

	const { recordName, type, appointmentId } = req.body;
	if (!recordName?.trim()) {
		try { await fs.unlink(req.file.path); } catch {}
		return res.status(400).json({ success: false, error: "Record name is required." });
	}

	const allowedTypes = ["Lab Report", "Prescription", "Scan", "Other", "Consultation Upload"];
	const fileType = allowedTypes.includes(type) ? type : "Other";

	try {
		const fileUrl = `${UPLOADS_BASE_URL}/${req.file.filename}`;

		const record = await MedicalRecordModel.create({
			patientId:     req.user.userId,
			recordName:    recordName.trim(),
			fileUrl,
			fileName:      req.file.originalname,
			fileType,
			mimeType:      req.file.mimetype,
			fileSize:      req.file.size,
			appointmentId: appointmentId || null,
		});

		// Fire-and-forget: OCR + Ollama summary in background
		processRecordInBackground(
			req.file.path,
			req.user.userId,
			record._id,
			fileType,
			req.file.originalname,
			req.file.mimetype
		);

		res.status(201).json({
			success: true,
			message: "Record uploaded. AI summary generating in background.",
			data: {
				id:         record._id,
				recordName: record.recordName,
				fileUrl:    record.fileUrl,
				fileName:   record.fileName,
				fileType:   record.fileType,
				uploadedAt: record.uploadedAt,
				aiSummary:  '',
			},
		});
	} catch (err) {
		try { await fs.unlink(req.file.path); } catch {}
		console.error("[MEDICAL-RECORDS] Upload error:", err.message);
		res.status(500).json({ success: false, error: "Failed to save record." });
	}
}

// ── Fetch (patient's own) ─────────────────────────────────────────────────────

export async function getMedicalRecords(req, res) {
	try {
		const records = await MedicalRecordModel.find({ patientId: req.user.userId })
			.sort({ uploadedAt: -1 })
			.lean();

		res.json({
			success: true,
			data: {
				records: records.map(r => ({
					id:                   r._id,
					recordName:           r.recordName,
					fileUrl:              r.fileUrl,
					fileName:             r.fileName,
					fileType:             r.fileType,
					fileSize:             r.fileSize,
					uploadedAt:           r.uploadedAt,
					appointmentId:        r.appointmentId,
					aiSummary:            r.aiSummary || '',
					aiSummaryGeneratedAt: r.aiSummaryGeneratedAt,
				})),
				total: records.length,
			},
		});
	} catch (err) {
		console.error("[MEDICAL-RECORDS] Fetch error:", err.message);
		res.status(500).json({ success: false, error: "Failed to fetch records." });
	}
}

// ── Fetch by patientId (doctor access) ───────────────────────────────────────

export async function getPatientMedicalRecords(req, res) {
	try {
		const { patientId } = req.params;
		const records = await MedicalRecordModel.find({ patientId })
			.sort({ uploadedAt: -1 })
			.lean();

		res.json({
			success: true,
			data: {
				records: records.map(r => ({
					id:            r._id,
					recordName:    r.recordName,
					fileUrl:       r.fileUrl,
					fileName:      r.fileName,
					fileType:      r.fileType,
					uploadedAt:    r.uploadedAt,
					appointmentId: r.appointmentId,
					aiSummary:     r.aiSummary || '',
				})),
				total: records.length,
			},
		});
	} catch (err) {
		console.error("[MEDICAL-RECORDS] Doctor fetch error:", err.message);
		res.status(500).json({ success: false, error: "Failed to fetch patient records." });
	}
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteMedicalRecord(req, res) {
	try {
		const record = await MedicalRecordModel.findOne({
			_id:       req.params.id,
			patientId: req.user.userId,
		});

		if (!record) {
			return res.status(404).json({ success: false, error: "Record not found." });
		}

		const uploadsDir = path.join(process.cwd(), "uploads");
		const filename   = path.basename(record.fileUrl);
		try { await fs.unlink(path.join(uploadsDir, filename)); } catch {}

		await MedicalRecordModel.deleteOne({ _id: record._id });

		res.json({ success: true, message: "Record deleted." });
	} catch (err) {
		console.error("[MEDICAL-RECORDS] Delete error:", err.message);
		res.status(500).json({ success: false, error: "Failed to delete record." });
	}
}
