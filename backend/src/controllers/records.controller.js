/**
 * Records Controller — MedHub AI+
 * Handles lab report upload, OCR processing, and retrieval.
 *
 * POST /api/records/upload  — multer + Tesseract.js OCR + Gemini structured parse → LabResult
 * GET  /api/records/lab-results — Patient's lab result history for Health Timeline
 */

import path from "path";
import fs from "fs/promises";
import { createWorker } from "tesseract.js";
import { LabResultModel } from "../models/LabResult.js";
import { parseLabReportOcr } from "../services/ollamaService.js";

// ─── Upload & OCR ─────────────────────────────────────────────────────────────

export async function uploadLabRecord(req, res) {
	const reqId = Date.now();
	console.log(`[RECORDS-${reqId}] Upload request from user ${req.user.userId}`);

	// multer attaches the file to req.file
	if (!req.file) {
		return res.status(400).json({ success: false, error: "No file uploaded." });
	}

	const { originalname, mimetype, path: filePath, size } = req.file;
	const patientId = req.user.userId;

	console.log(`[RECORDS-${reqId}] File: ${originalname} (${mimetype}, ${size} bytes)`);

	try {
		// ── Step 1: OCR with Tesseract.js ────────────────────────────────────
		console.log(`[RECORDS-${reqId}] Starting OCR...`);

		const worker = await createWorker("eng");
		let rawOcrText = "";

		try {
			const { data: { text } } = await worker.recognize(filePath);
			rawOcrText = text.trim();
			console.log(`[RECORDS-${reqId}] OCR complete. Chars: ${rawOcrText.length}`);
		} finally {
			await worker.terminate();
		}

		if (!rawOcrText || rawOcrText.length < 20) {
			return res.status(422).json({
				success: false,
				error: "Could not extract readable text from the file. Please upload a clearer image or text-based PDF."
			});
		}

		// ── Step 2: Ollama Structured Parsing ───────────────────────────────
		console.log(`[RECORDS-${reqId}] Sending to Ollama for structured parse...`);

		let parsedData = { tests: [], labName: null, recordDate: null, doctorOrdered: null };
		try {
			parsedData = await parseLabReportOcr(rawOcrText);
		} catch (ollamaError) {
			console.warn(`[RECORDS-${reqId}] Ollama parse failed (saving raw OCR only):`, ollamaError.message);
		}

		// ── Step 3: Save LabResult to MongoDB ────────────────────────────────
		const labResult = await LabResultModel.create({
			patientId,
			uploadedBy:     patientId,
			rawOcrText,
			structuredData: (parsedData.tests || []).map(t => ({
				testName:       t.testName,
				value:          t.value,
				numericValue:   t.numericValue,
				unit:           t.unit || "",
				referenceRange: t.referenceRange || "",
				flag:           t.flag || "unknown"
			})),
			fileName:       originalname,
			fileType:       mimetype.includes("pdf") ? "pdf" : "image",
			recordDate:     parsedData.recordDate ? new Date(parsedData.recordDate) : new Date(),
			labName:        parsedData.labName || null,
			doctorOrdered:  parsedData.doctorOrdered || null
		});

		console.log(`[RECORDS-${reqId}] LabResult saved: ${labResult._id}`);

		// ── Step 4: Cleanup temp file ────────────────────────────────────────
		try {
			await fs.unlink(filePath);
		} catch {
			// Non-critical — temp file cleanup
		}

		res.status(201).json({
			success: true,
			message: `Lab report processed. ${labResult.structuredData.length} test values extracted.`,
			data: {
				labResultId:    labResult._id,
				fileName:       labResult.fileName,
				recordDate:     labResult.recordDate,
				labName:        labResult.labName,
				testsExtracted: labResult.structuredData.length,
				structuredData: labResult.structuredData,
				rawOcrPreview:  rawOcrText.substring(0, 300) + (rawOcrText.length > 300 ? "..." : "")
			}
		});

	} catch (error) {
		console.error(`[RECORDS-${reqId}] Error:`, error.message);

		// Cleanup temp file on error
		try { await fs.unlink(filePath); } catch {}

		if (error.message?.includes("OLLAMA") || error.message?.includes("connect")) {
				return res.status(503).json({
					success: false,
					error: "AI parsing service unavailable. Ollama may not be running.",
				});
			}

		res.status(500).json({ success: false, error: "Failed to process lab record." });
	}
}

// ─── Get Lab Results (Health Timeline) ───────────────────────────────────────

export async function getLabResults(req, res) {
	try {
		const patientId = req.user.userId;

		const labResults = await LabResultModel.find({ patientId })
			.sort({ recordDate: -1 })
			.limit(20)
			.lean();

		// Build timeline data: one entry per unique test name across reports
		const timelineMap = {};

		for (const lr of labResults) {
			const dateStr = (lr.recordDate || lr.createdAt).toISOString().split("T")[0];

			for (const test of lr.structuredData) {
				if (test.numericValue == null) continue; // skip non-numeric

				if (!timelineMap[test.testName]) {
					timelineMap[test.testName] = {
						testName: test.testName,
						unit:     test.unit,
						series:   []
					};
				}

				timelineMap[test.testName].series.push({
					date:           dateStr,
					value:          test.numericValue,
					flag:           test.flag,
					referenceRange: test.referenceRange,
					labResultId:    lr._id
				});
			}
		}

		// Sort each series by date ascending 
		const timeline = Object.values(timelineMap).map(t => ({
			...t,
			series: t.series.sort((a, b) => new Date(a.date) - new Date(b.date))
		}));

		res.json({
			success: true,
			data: {
				labResults: labResults.map(lr => ({
					id:             lr._id,
					fileName:       lr.fileName,
					recordDate:     lr.recordDate,
					labName:        lr.labName,
					testsCount:     lr.structuredData.length,
					structuredData: lr.structuredData,
					createdAt:      lr.createdAt
				})),
				timeline,
				totalRecords: labResults.length
			}
		});

	} catch (error) {
		console.error("Get lab results error:", error);
		res.status(500).json({ success: false, error: "Failed to fetch lab results." });
	}
}
