import { Router } from "express";
import multer from "multer";
import path   from "path";
import { signup, login, refreshToken, logout, logoutAllDevices, getMe, getActiveSessions } from "../controllers/auth.controller.js";
import { authenticate, authRateLimit } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// Multer for optional doctor license upload during signup
const licenseUpload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), "uploads")),
		filename:    (_req, file, cb) => cb(null, `license-${Date.now()}${path.extname(file.originalname)}`)
	}),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
		cb(null, allowed.includes(file.mimetype));
	}
});

// Public routes — signup accepts optional license file for doctors
router.post("/signup", authRateLimit, licenseUpload.single("licenseFile"), signup);
router.post("/login",   authRateLimit, login);
router.post("/refresh", refreshToken);
router.post("/logout",  logout);

// Protected routes
router.get("/me",       authenticate, getMe);
router.get("/sessions", authenticate, getActiveSessions);
router.post("/logout-all", authenticate, logoutAllDevices);

// Admin only routes
router.get("/users", authenticate, requireRole(["ADMIN"]), (req, res) => {
	res.json({ message: "Admin users endpoint" });
});

export default router;





