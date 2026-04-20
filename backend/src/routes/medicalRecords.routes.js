import express from "express";
import multer from "multer";
import path from "path";
import { uploadMedicalRecord, getMedicalRecords, deleteMedicalRecord } from "../controllers/medicalRecords.controller.js";

const router = express.Router();

// Store files persistently in /uploads with unique filenames
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, path.join(process.cwd(), "uploads"));
	},
	filename: (_req, file, cb) => {
		const ext    = path.extname(file.originalname);
		const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
		cb(null, unique);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
	fileFilter: (_req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
		if (allowed.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Only JPG, PNG, and PDF files are accepted."));
		}
	},
});

// POST /api/medical-records/upload
router.post("/upload", upload.single("file"), uploadMedicalRecord);

// GET /api/medical-records
router.get("/", getMedicalRecords);

// DELETE /api/medical-records/:id
router.delete("/:id", deleteMedicalRecord);

export default router;
