/**
 * Medical Records Controller
 * POST /api/medical-records/upload  — multer → local /uploads → MongoDB
 * GET  /api/medical-records         — patient's records sorted by latest
 * DELETE /api/medical-records/:id   — delete a record
 */

import fs from "fs/promises";
import path from "path";
import Tesseract from "tesseract.js";
import { MedicalRecordModel } from "../models/MedicalRecord.js";
import { LabResultModel } from "../models/LabResult.js";
import { parseLabReportOcr } from "../services/ollamaService.js";

const UPLOADS_BASE_URL = process.env.UPLOADS_BASE_URL || "http://localhost:4000/uploads";

// ─── OCR Helper ───────────────────────────────────────────────────────────────

async function processLaboratoryReport(filePath, patientId, recordId) {
	try {
		const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
		if (!text?.trim() || text.trim().length < 20) return;

		const structured = await parseLabReportOcr(text);

		await LabResultModel.create({
			patientId,
			medicalRecordId: recordId,
			labName:         structured.labName || null,
			recordDate:      structured.recordDate ? new Date(structured.recordDate) : new Date(),
			doctorOrdered:   structured.doctorOrdered || null,
			structuredData:  structured.tests || [],
			rawText:         text,
		});
		console.log(`[OCR] Successfully processed lab report for record: ${recordId} — ${structured.tests?.length || 0} tests found`);
	} catch (err) {
		console.error("[OCR/AI Error]", err.message);
	}
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadMedicalRecord(req, res) {
	if (!req.file) {
		return res.status(400).json({ success: false, error: "No file uploaded." });
	}

	const { recordName, type } = req.body;
	if (!recordName?.trim()) {
		try { await fs.unlink(req.file.path); } catch {}
		return res.status(400).json({ success: false, error: "Record name is required." });
	}

	const allowedTypes = ["Lab Report", "Prescription", "Scan", "Other"];
	const fileType = allowedTypes.includes(type) ? type : "Other";

	try {
		const fileUrl = `${UPLOADS_BASE_URL}/${req.file.filename}`;

		const record = await MedicalRecordModel.create({
			patientId:  req.user.userId,
			recordName: recordName.trim(),
			fileUrl,
			fileName:   req.file.originalname,
			fileType,
			mimeType:   req.file.mimetype,
			fileSize:   req.file.size,
		});

		// Fire-and-forget OCR for Lab Reports — user gets instant response
		if (fileType === "Lab Report") {
			processLaboratoryReport(req.file.path, req.user.userId, record._id);
		}

		res.status(201).json({
			success: true,
			message: fileType === "Lab Report"
				? "Lab report uploaded. OCR processing in background."
				: "Record uploaded successfully.",
			data: {
				id:         record._id,
				recordName: record.recordName,
				fileUrl:    record.fileUrl,
				fileName:   record.fileName,
				fileType:   record.fileType,
				uploadedAt: record.uploadedAt,
			},
		});
	} catch (err) {
		try { await fs.unlink(req.file.path); } catch {}
		console.error("[MEDICAL-RECORDS] Upload error:", err.message);
		res.status(500).json({ success: false, error: "Failed to save record." });
	}
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function getMedicalRecords(req, res) {
	try {
		const records = await MedicalRecordModel.find({ patientId: req.user.userId })
			.sort({ uploadedAt: -1 })
			.lean();

		res.json({
			success: true,
			data: {
				records: records.map(r => ({
					id:         r._id,
					recordName: r.recordName,
					fileUrl:    r.fileUrl,
					fileName:   r.fileName,
					fileType:   r.fileType,
					fileSize:   r.fileSize,
					uploadedAt: r.uploadedAt,
				})),
				total: records.length,
			},
		});
	} catch (err) {
		console.error("[MEDICAL-RECORDS] Fetch error:", err.message);
		res.status(500).json({ success: false, error: "Failed to fetch records." });
	}
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteMedicalRecord(req, res) {
	try {
		const record = await MedicalRecordModel.findOne({
			_id:       req.params.id,
			patientId: req.user.userId,
		});

		if (!record) {
			return res.status(404).json({ success: false, error: "Record not found." });
		}

		// Delete physical file
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
