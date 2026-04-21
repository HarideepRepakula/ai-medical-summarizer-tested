import express from "express";
import multer from "multer";
import path from "path";
import { uploadMedicalRecord, getMedicalRecords, deleteMedicalRecord, getPatientMedicalRecords } from "../controllers/medicalRecords.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), "uploads")),
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname);
		cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
	fileFilter: (_req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
		cb(null, allowed.includes(file.mimetype));
	},
});

// Patient routes
router.post("/upload",    upload.single("file"), uploadMedicalRecord);
router.get("/",           getMedicalRecords);
router.delete("/:id",     deleteMedicalRecord);

// Doctor route — view any patient's records
router.get("/patient/:patientId", requireRole(["DOCTOR"]), getPatientMedicalRecords);

export default router;
