import express from "express";
import multer from "multer";
import path from "path";
import os from "os";
import { uploadLabRecord, getLabResults } from "../controllers/records.controller.js";

const router = express.Router();

// Multer config: store in system temp dir, accept images + PDFs
const upload = multer({
	dest: os.tmpdir(),
	limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
	fileFilter: (_req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/tiff", "image/gif", "application/pdf"];
		if (allowed.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Only images (JPG, PNG, TIFF) and PDFs are accepted."));
		}
	}
});

// POST /api/records/upload — upload + OCR + Gemini parse
router.post("/upload", upload.single("file"), uploadLabRecord);

// GET /api/records/lab-results — patient's lab history + timeline data
router.get("/lab-results", getLabResults);

export default router;
