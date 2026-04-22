import express from "express";
import multer from "multer";
import os from "os";
import {
	getProducts,
	createAutoCart,
	deselectMedicine,
	confirmOrder,
	getOrders,
	updateOrderStatus,
	uploadExternalPrescription
} from "../controllers/pharmacy.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

const prescUpload = multer({
	dest: os.tmpdir(),
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/tiff", "application/pdf"];
		cb(null, allowed.includes(file.mimetype));
	}
});

// POST /api/pharmacy/upload-prescription — Patient only
router.post("/upload-prescription", requireRole(["PATIENT"]), prescUpload.single("file"), uploadExternalPrescription);

// GET /api/pharmacy/products — All authenticated users
router.get("/products", getProducts);

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
