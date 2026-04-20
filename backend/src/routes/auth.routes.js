import { Router } from "express";
import { signup, login, refreshToken, logout, logoutAllDevices, getMe, getActiveSessions } from "../controllers/auth.controller.js";
import { authenticate, authRateLimit } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// Public routes with rate limiting
router.post("/signup", authRateLimit, signup);
router.post("/login", authRateLimit, login);
router.post("/refresh", refreshToken); // No rate limit for token refresh
router.post("/logout", logout);

// Protected routes
router.get("/me", authenticate, getMe);
router.get("/sessions", authenticate, getActiveSessions);
router.post("/logout-all", authenticate, logoutAllDevices);

// Admin only routes
router.get("/users", authenticate, requireRole(["ADMIN"]), (req, res) => {
	res.json({ message: "Admin users endpoint" });
});

export default router;





