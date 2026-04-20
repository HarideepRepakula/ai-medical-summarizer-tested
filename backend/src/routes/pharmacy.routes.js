import express from "express";
import {
	createAutoCart,
	deselectMedicine,
	confirmOrder,
	getOrders,
	updateOrderStatus
} from "../controllers/pharmacy.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// POST /api/pharmacy/auto-cart — Doctor only
router.post("/auto-cart", requireRole(["DOCTOR", "ADMIN"]), createAutoCart);

// GET /api/pharmacy/orders — Patient/Doctor/Pharmacy/Admin
router.get("/orders", getOrders);

// PATCH /api/pharmacy/orders/:orderId/deselect — Patient only
router.patch("/orders/:orderId/deselect", requireRole(["PATIENT"]), deselectMedicine);

// PATCH /api/pharmacy/orders/:orderId/confirm — Patient only
router.patch("/orders/:orderId/confirm", requireRole(["PATIENT"]), confirmOrder);

// PATCH /api/pharmacy/orders/:orderId/status — Pharmacy/Admin only
router.patch("/orders/:orderId/status", requireRole(["PHARMACY", "ADMIN"]), updateOrderStatus);

export default router;
