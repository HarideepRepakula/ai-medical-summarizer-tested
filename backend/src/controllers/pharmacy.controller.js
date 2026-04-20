/**
 * Pharmacy Controller — MedHub AI+
 * Auto-cart creation from prescriptions, patient deselect, order management.
 */

import { PrescriptionModel }  from "../models/Prescription.js";
import { PharmacyOrderModel } from "../models/PharmacyOrder.js";
import { InventoryModel }     from "../models/Inventory.js";
import { UserModel }          from "../models/User.js";

// ─── Auto-Cart Creation ───────────────────────────────────────────────────────

/**
 * POST /api/pharmacy/auto-cart
 * Called after a doctor submits a prescription.
 * Matches each medicine against Inventory (text search) and creates a PharmacyOrder.
 */
export async function createAutoCart(req, res) {
	try {
		const { prescriptionId } = req.body;

		if (!prescriptionId) {
			return res.status(400).json({ success: false, error: "prescriptionId is required." });
		}

		const prescription = await PrescriptionModel.findById(prescriptionId)
			.populate("patientId", "name email phone")
			.populate("doctorId",  "name")
			.lean();

		if (!prescription) {
			return res.status(404).json({ success: false, error: "Prescription not found." });
		}

		// Prevent duplicate cart creation
		if (prescription.autoCartCreated) {
			const existing = await PharmacyOrderModel.findOne({ prescriptionId }).lean();
			if (existing) {
				return res.json({
					success: true,
					message: "Auto-cart already exists.",
					data: { orderId: existing._id }
				});
			}
		}

		// ── Match medicines to Inventory ──────────────────────────────────────
		const orderItems = [];

		for (const med of prescription.medicines) {
			// Text search: match by name or generic name
			const inventoryItem = await InventoryModel.findOne({
				$text: { $search: med.name },
				isActive: true
			}).sort({ score: { $meta: "textScore" } }).lean();

			orderItems.push({
				medicineId: inventoryItem?._id || null,
				name:       med.name,
				dosage:     med.dosage,
				quantity:   med.quantity,
				unitPrice:  inventoryItem?.price || 0,
				lineTotal:  (inventoryItem?.price || 0) * med.quantity,
				deselected: false,
				inStock:    inventoryItem ? inventoryItem.stock >= med.quantity : false
			});
		}

		const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

		// ── Create PharmacyOrder ──────────────────────────────────────────────
		const order = await PharmacyOrderModel.create({
			patientId:      prescription.patientId._id,
			prescriptionId: prescription._id,
			doctorId:       prescription.doctorId._id,
			medicines:      orderItems,
			total,
			status:         "pending_patient_review"
		});

		// Mark prescription as having a cart
		await PrescriptionModel.findByIdAndUpdate(prescriptionId, { autoCartCreated: true });

		console.log(`[PHARMACY] Auto-cart created: ${order._id} for patient ${prescription.patientId._id}`);

		res.status(201).json({
			success: true,
			message: `Auto-cart created with ${orderItems.length} items. Patient can review before confirming.`,
			data: {
				orderId:      order._id,
				patientName:  prescription.patientId.name,
				itemCount:    orderItems.length,
				total,
				itemsInStock: orderItems.filter(i => i.inStock).length
			}
		});

	} catch (error) {
		console.error("Auto-cart error:", error.message);
		res.status(500).json({ success: false, error: "Failed to create auto-cart." });
	}
}

// ─── Patient Deselect Medicine ────────────────────────────────────────────────

/**
 * PATCH /api/pharmacy/orders/:orderId/deselect
 * Patient can toggle individual medicines in/out of their cart.
 * Body: { medicineIndex: number, deselected: boolean }
 */
export async function deselectMedicine(req, res) {
	try {
		const { orderId }                    = req.params;
		const { medicineIndex, deselected }  = req.body;
		const patientId                      = req.user.userId;

		if (medicineIndex === undefined || deselected === undefined) {
			return res.status(400).json({ success: false, error: "medicineIndex and deselected are required." });
		}

		const order = await PharmacyOrderModel.findById(orderId);
		if (!order) {
			return res.status(404).json({ success: false, error: "Order not found." });
		}

		// Only the patient can deselect
		if (order.patientId.toString() !== patientId) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		if (order.status !== "pending_patient_review") {
			return res.status(400).json({ success: false, error: "Order can only be edited while in 'pending_patient_review' status." });
		}

		if (medicineIndex < 0 || medicineIndex >= order.medicines.length) {
			return res.status(400).json({ success: false, error: "Invalid medicine index." });
		}

		// Update the specific medicine's deselected flag
		order.medicines[medicineIndex].deselected = Boolean(deselected);

		// Recalculate total (exclude deselected)
		order.total = order.medicines.reduce(
			(sum, item) => sum + (item.deselected ? 0 : item.lineTotal),
			0
		);

		order.markModified("medicines");
		await order.save();

		res.json({
			success: true,
			message: `Medicine ${deselected ? "removed from" : "added back to"} cart.`,
			data: {
				orderId,
				medicines:  order.medicines,
				newTotal:   order.total
			}
		});

	} catch (error) {
		console.error("Deselect medicine error:", error.message);
		res.status(500).json({ success: false, error: "Failed to update cart." });
	}
}

// ─── Confirm Order ────────────────────────────────────────────────────────────

/**
 * PATCH /api/pharmacy/orders/:orderId/confirm
 * Patient confirms the cart → status moves to "confirmed"
 */
export async function confirmOrder(req, res) {
	try {
		const { orderId }        = req.params;
		const { deliveryOption, deliveryAddress } = req.body;
		const patientId          = req.user.userId;

		const order = await PharmacyOrderModel.findById(orderId);
		if (!order) {
			return res.status(404).json({ success: false, error: "Order not found." });
		}

		if (order.patientId.toString() !== patientId) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		if (order.status !== "pending_patient_review") {
			return res.status(400).json({ success: false, error: "Order is not in review state." });
		}

		order.status          = "confirmed";
		order.deliveryOption  = deliveryOption || order.deliveryOption;
		order.deliveryAddress = deliveryAddress || "";
		order.confirmedAt     = new Date();
		await order.save();

		res.json({
			success: true,
			message: "Order confirmed and sent to pharmacy.",
			data: { orderId, status: order.status, total: order.total }
		});

	} catch (error) {
		console.error("Confirm order error:", error.message);
		res.status(500).json({ success: false, error: "Failed to confirm order." });
	}
}

// ─── Get Patient's Orders ─────────────────────────────────────────────────────

/**
 * GET /api/pharmacy/orders
 * Returns all pharmacy orders for the requesting user.
 */
export async function getOrders(req, res) {
	try {
		const userId   = req.user.userId;
		const userRole = req.user.role;

		let filter = {};
		if (userRole === "PATIENT")  filter.patientId = userId;
		else if (userRole === "DOCTOR") filter.doctorId = userId;
		// PHARMACY role sees all orders
		else if (userRole !== "PHARMACY" && userRole !== "ADMIN") {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		const orders = await PharmacyOrderModel.find(filter)
			.populate("patientId",      "name phone email")
			.populate("doctorId",       "name")
			.populate("prescriptionId", "medicines status createdAt")
			.sort({ createdAt: -1 })
			.limit(50)
			.lean();

		res.json({
			success: true,
			data: {
				orders: orders.map(o => ({
					id:             o._id,
					patient:        { id: o.patientId?._id, name: o.patientId?.name, phone: o.patientId?.phone },
					doctor:         { id: o.doctorId?._id,  name: o.doctorId?.name },
					medicines:      o.medicines,
					status:         o.status,
					total:          o.total,
					deliveryOption: o.deliveryOption,
					createdAt:      o.createdAt,
					confirmedAt:    o.confirmedAt
				})),
				count: orders.length
			}
		});

	} catch (error) {
		console.error("Get orders error:", error.message);
		res.status(500).json({ success: false, error: "Failed to fetch orders." });
	}
}

// ─── Update Order Status (Pharmacy staff) ────────────────────────────────────

/**
 * PATCH /api/pharmacy/orders/:orderId/status
 * Pharmacy staff updates order status (processing → ready → delivered)
 */
export async function updateOrderStatus(req, res) {
	try {
		const { orderId } = req.params;
		const { status }  = req.body;
		const userRole    = req.user.role;

		if (!["PHARMACY", "ADMIN"].includes(userRole)) {
			return res.status(403).json({ success: false, error: "Pharmacy staff only." });
		}

		const validStatuses = ["confirmed", "processing", "ready", "delivered", "cancelled"];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({ success: false, error: "Invalid status." });
		}

		const update = { status };
		if (status === "delivered")    update.deliveredAt  = new Date();
		if (status === "processing")   update.processedAt  = new Date();

		const order = await PharmacyOrderModel.findByIdAndUpdate(orderId, update, { new: true }).lean();
		if (!order) {
			return res.status(404).json({ success: false, error: "Order not found." });
		}

		res.json({ success: true, data: { orderId, status: order.status } });

	} catch (error) {
		console.error("Update order status error:", error.message);
		res.status(500).json({ success: false, error: "Failed to update order status." });
	}
}
