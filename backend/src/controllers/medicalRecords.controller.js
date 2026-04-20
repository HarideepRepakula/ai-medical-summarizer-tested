/**
 * Medical Records Controller
 * POST /api/medical-records/upload  — multer → local /uploads → MongoDB
 * GET  /api/medical-records         — patient's records sorted by latest
 * DELETE /api/medical-records/:id   — delete a record
 */

import fs from "fs/promises";
import path from "path";
import { MedicalRecordModel } from "../models/MedicalRecord.js";

const UPLOADS_BASE_URL = process.env.UPLOADS_BASE_URL || "http://localhost:4000/uploads";

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadMedicalRecord(req, res) {
	if (!req.file) {
		return res.status(400).json({ success: false, error: "No file uploaded." });
	}

	const { recordName, type } = req.body;
	if (!recordName?.trim()) {
		// Cleanup orphaned file
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

		res.status(201).json({
			success: true,
			message: "Record uploaded successfully.",
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
