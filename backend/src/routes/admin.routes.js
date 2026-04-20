import express from "express";
import multer  from "multer";
import path    from "path";
import {
	getAiSystemReport,
	getPendingVerifications,
	reVerifyDoctor,
	getLockedAccounts,
	unlockAccount,
	moderateRecord
} from "../controllers/admin.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// Multer for license + record uploads
const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), "uploads")),
		filename:    (_req, file, cb) => cb(null, `admin-${Date.now()}${path.extname(file.originalname)}`)
	}),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
		cb(null, allowed.includes(file.mimetype));
	}
});

// All admin routes require ADMIN role
router.use(requireRole(["ADMIN"]));

// System health
router.get("/audit-report",              getAiSystemReport);

// Doctor verification
router.get("/pending-verifications",     getPendingVerifications);
router.post("/verify-doctor/:doctorId",  upload.single("file"), reVerifyDoctor);

// Security / fraud detection
router.get("/security/locked-accounts",  getLockedAccounts);
router.post("/security/unlock/:userId",  unlockAccount);

// Content moderation
router.post("/moderate-record",          upload.single("file"), moderateRecord);

export default router;
