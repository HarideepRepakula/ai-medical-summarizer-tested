/**
 * Prescription Controller — MedHub AI+
 * Create, retrieve prescriptions. Triggers auto-cart on creation.
 */

import { PrescriptionModel }  from "../models/Prescription.js";
import { UserModel }          from "../models/User.js";

// POST /api/prescriptions — Doctor creates a prescription
export async function createPrescription(req, res) {
	try {
		const { patientId, appointmentId, medicines, diagnosis, notes } = req.body;
		const doctorId = req.user.userId;

		if (!patientId || !medicines?.length) {
			return res.status(400).json({ success: false, error: "patientId and medicines are required." });
		}

		if (req.user.role !== "DOCTOR") {
			return res.status(403).json({ success: false, error: "Only doctors can create prescriptions." });
		}

		const prescription = await PrescriptionModel.create({
			patientId,
			doctorId,
			appointmentId: appointmentId || null,
			medicines,
			diagnosis: diagnosis || "",
			notes: notes || "",
			status: "active"
		});

		// Trigger auto-cart (non-blocking)
		process.nextTick(async () => {
			try {
				await createAutoCartInternal(prescription._id);
			} catch (err) {
				console.error("[PRESCRIPTION] Auto-cart trigger failed:", err.message);
			}
		});

		res.status(201).json({
			success: true,
			message: "Prescription created. Auto-cart will be prepared for the patient.",
			data: {
				prescriptionId: prescription._id,
				patientId,
				medicines: prescription.medicines,
				status: prescription.status
			}
		});

	} catch (error) {
		console.error("Create prescription error:", error.message);
		res.status(500).json({ success: false, error: "Failed to create prescription." });
	}
}

// Internal helper to trigger auto-cart without HTTP round-trip
async function createAutoCartInternal(prescriptionId) {
	const { PrescriptionModel }  = await import("../models/Prescription.js");
	const { PharmacyOrderModel } = await import("../models/PharmacyOrder.js");
	const { InventoryModel }     = await import("../models/Inventory.js");

	const prescription = await PrescriptionModel.findById(prescriptionId).lean();
	if (!prescription || prescription.autoCartCreated) return;

	const orderItems = [];
	for (const med of prescription.medicines) {
		const item = await InventoryModel.findOne({
			$text: { $search: med.name }, isActive: true
		}).sort({ score: { $meta: "textScore" } }).lean();

		orderItems.push({
			medicineId: item?._id || null,
			name:       med.name,
			dosage:     med.dosage,
			quantity:   med.quantity,
			unitPrice:  item?.price || 0,
			lineTotal:  (item?.price || 0) * med.quantity,
			deselected: false,
			inStock:    item ? item.stock >= med.quantity : false
		});
	}

	const total = orderItems.reduce((s, i) => s + i.lineTotal, 0);

	await PharmacyOrderModel.create({
		patientId:      prescription.patientId,
		prescriptionId: prescription._id,
		doctorId:       prescription.doctorId,
		medicines:      orderItems,
		total,
		status:         "pending_patient_review"
	});

	await PrescriptionModel.findByIdAndUpdate(prescriptionId, { autoCartCreated: true });
	console.log(`[PHARMACY] Auto-cart created for prescription ${prescriptionId}`);
}

// GET /api/prescriptions — Get prescriptions (patient or doctor)
export async function getPrescriptions(req, res) {
	try {
		const userId   = req.user.userId;
		const userRole = req.user.role;

		let filter = {};
		if (userRole === "PATIENT") filter.patientId = userId;
		if (userRole === "DOCTOR")  filter.doctorId  = userId;

		const prescriptions = await PrescriptionModel.find(filter)
			.populate("patientId", "name phone email")
			.populate("doctorId",  "name specialty")
			.sort({ createdAt: -1 })
			.limit(20)
			.lean();

		res.json({ success: true, data: { prescriptions, count: prescriptions.length } });

	} catch (error) {
		console.error("Get prescriptions error:", error.message);
		res.status(500).json({ success: false, error: "Failed to fetch prescriptions." });
	}
}
