/**
 * Pharmacy Controller — ClinIQ AI+
 * Auto-cart creation from prescriptions, external prescription parsing, order management.
 *
 * Smart Medicine Matching (3-Layer System):
 *   Layer 1 → Exact / partial MongoDB regex match        (fast, no AI)
 *   Layer 2 → Ollama fuzzy brand→generic mapping         (handles "Dolo"→"Paracetamol")
 *   Layer 3 → Mark as "not_found" for manual search      (graceful fallback)
 *
 * BART Python bridge fully removed — external prescriptions now use
 * Ollama extractMedicationsFromText() via Tesseract OCR.
 */

import fs                       from "fs/promises";
import path                     from "path";
import { extractTextFromFile }  from "../utils/fileExtraction.js";
import { PrescriptionModel }    from "../models/Prescription.js";
import { PharmacyOrderModel }   from "../models/PharmacyOrder.js";
import { InventoryModel }       from "../models/Inventory.js";
import { UserModel }            from "../models/User.js";
import {
	mapMedsToInventory,
	extractMedicationsFromText
} from "../services/ollamaService.js";

// ─── Layer 1: Fast MongoDB Partial Match ─────────────────────────────────────

/**
 * Tries to find an inventory item using a cascading set of regex strategies:
 *   1. Exact name match (case-insensitive)
 *   2. Name starts-with match
 *   3. Name contains first significant word (e.g. "Paracetamol" from "Paracetamol 500mg")
 *   4. Generic name match
 */
async function layer1Match(medName) {
	const name    = medName.trim();
	// Extract the first "word" that's at least 4 chars long (the actual drug name)
	const keyword = name.split(/\s+/).find(w => w.length >= 4) || name.split(/\s+/)[0];

	const strategies = [
		// Exact match
		{ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }, isActive: true },
		// Starts with the full name
		{ name: { $regex: `^${escapeRegex(name)}`, $options: 'i' }, isActive: true },
		// Name contains the keyword
		{ name: { $regex: escapeRegex(keyword), $options: 'i' }, isActive: true },
		// Generic name contains the keyword
		{ genericName: { $regex: escapeRegex(keyword), $options: 'i' }, isActive: true },
	];

	for (const query of strategies) {
		const item = await InventoryModel.findOne(query)
			.select('name genericName category dosageStrength price stock image')
			.lean();
		if (item) return item;
	}
	return null;
}

function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── 3-Layer Matching Engine ──────────────────────────────────────────────────

/**
 * Runs all three matching layers for a list of medicine names.
 * Returns { matched: [{inventoryItem, originalName}], unmatched: [string] }
 */
async function smartMatchMedicines(medNames) {
	const matched   = [];
	const needsAI   = [];

	// Layer 1: Fast regex for each medicine
	for (const name of medNames) {
		const item = await layer1Match(name);
		if (item) {
			matched.push({ inventoryItem: item, originalName: name, matchLayer: 1 });
		} else {
			needsAI.push(name);
		}
	}

	// Layer 2: Ollama fuzzy brand→generic for unmatched items
	if (needsAI.length > 0) {
		try {
			const allProducts = await InventoryModel.find({ isActive: true })
				.select('name genericName category price stock image')
				.lean();

			const aiMatched = await mapMedsToInventory(needsAI, allProducts);

			// Map AI results back to original names
			for (const product of aiMatched) {
				// Find which original name this product was matched to
				const originalName = needsAI.find(n =>
					product.name?.toLowerCase().includes(n.split(/\s+/)[0].toLowerCase()) ||
					n.toLowerCase().includes(product.name?.split(/\s+/)[0].toLowerCase()) ||
					(product.genericName && product.genericName.toLowerCase().includes(n.split(/\s+/)[0].toLowerCase()))
				) || needsAI[0];

				matched.push({ inventoryItem: product, originalName, matchLayer: 2 });
			}

			// Layer 3: Still unmatched after AI → mark as not found
			const aiMatchedNames = aiMatched.map(p => p.name?.toLowerCase());
			const stillUnmatched = needsAI.filter(n =>
				!matched.some(m => m.originalName === n && m.matchLayer === 2)
			);

			return { matched, unmatched: stillUnmatched };
		} catch (aiErr) {
			console.warn('[PHARMACY] Ollama layer-2 matching failed:', aiErr.message);
			// If Ollama fails, fall straight to layer 3
			return { matched, unmatched: needsAI };
		}
	}

	return { matched, unmatched: [] };
}

// ─── Upload External Prescription (Patient) ───────────────────────────────────

/**
 * POST /api/pharmacy/upload-prescription
 * Patient uploads an external prescription image/PDF.
 * Uses Tesseract OCR + Ollama extractMedicationsFromText() — replaces BART bridge.
 * Patient must confirm before cart is created.
 */
export async function uploadExternalPrescription(req, res) {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: "No file uploaded." });
		}

		// Step 1: Extract text from the prescription image/PDF
		let ocrText = '';
		try {
			console.log('[PHARMACY] Running text extraction on prescription...');
			ocrText = await extractTextFromFile(req.file.path, req.file.mimetype);
			console.log(`[PHARMACY] Extracted ${ocrText.length} chars`);
		} catch (ocrErr) {
			console.error('[PHARMACY] Extraction failed:', ocrErr.message);
		}

		// Cleanup uploaded file
		try { await fs.unlink(req.file.path); } catch {}

		if (ocrText.length < 10) {
			return res.status(422).json({
				success: false,
				error: "Could not extract text from this prescription. Please upload a clearer image (JPG/PNG) or a digital PDF."
			});
		}

		// Step 2: Extract medicine names using Ollama (replaces BART)
		console.log('[PHARMACY] Extracting medicine names via Ollama...');
		const extractedNames = await extractMedicationsFromText(ocrText);
		console.log(`[PHARMACY] Ollama extracted ${extractedNames.length} medicines:`, extractedNames);

		if (extractedNames.length === 0) {
			return res.json({
				success: true,
				message: "No medicines could be detected. Please verify manually.",
				data: {
					matchedProducts: [],
					unmatched:       [],
					extractedMeds:   [],
					summary:         ocrText.substring(0, 300)
				}
			});
		}

		// Step 3: 3-Layer smart matching against inventory
		const { matched, unmatched } = await smartMatchMedicines(extractedNames);

		res.json({
			success: true,
			message: `AI detected ${extractedNames.length} medicine(s). ${matched.length} matched in inventory. Please verify before adding to cart.`,
			data: {
				matchedProducts: matched.map(m => ({
					_id:        m.inventoryItem._id,
					name:       m.inventoryItem.name,
					price:      m.inventoryItem.price,
					stock:      m.inventoryItem.stock,
					category:   m.inventoryItem.category,
					image:      m.inventoryItem.image || null,
					matchLayer: m.matchLayer,          // 1 = exact, 2 = AI fuzzy
					prescribedAs: m.originalName       // what the doctor wrote
				})),
				unmatched,
				extractedMeds: extractedNames,
				summary: `Prescription processed. Found: ${extractedNames.join(', ')}.`
			}
		});

	} catch (error) {
		console.error("Upload external prescription error:", error.message);
		// Cleanup file on error
		if (req.file?.path) try { await fs.unlink(req.file.path); } catch {}
		res.status(500).json({ success: false, error: "Failed to process prescription." });
	}
}

// ─── Get Inventory Products ───────────────────────────────────────────────────

/**
 * GET /api/pharmacy/products
 * Returns inventory items for the pharmacy store.
 * Query: ?category=Antibiotics
 */
export async function getProducts(req, res) {
	try {
		const { category } = req.query;
		const filter = { isActive: true, stock: { $gt: 0 } };
		if (category && category !== 'All') filter.category = category;

		const products = await InventoryModel.find(filter)
			.select('name genericName brand category dosageStrength unit stock price image status')
			.sort({ name: 1 })
			.lean();

		res.json({ success: true, data: { products, count: products.length } });
	} catch (error) {
		console.error('Get products error:', error.message);
		res.status(500).json({ success: false, error: 'Failed to fetch products.' });
	}
}

// ─── Auto-Cart Creation (3-Layer Smart Matching) ─────────────────────────────

/**
 * POST /api/pharmacy/auto-cart
 * Called after a doctor submits a prescription.
 * Uses 3-layer matching: regex → Ollama fuzzy → not found.
 * Creates a PharmacyOrder for patient review.
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

		// ── 3-Layer Smart Matching ─────────────────────────────────────────────
		const medNames = prescription.medicines.map(m => m.name);
		console.log(`[PHARMACY] Smart-matching ${medNames.length} medicines:`, medNames);

		const { matched, unmatched } = await smartMatchMedicines(medNames);
		console.log(`[PHARMACY] Matched: ${matched.length}, Unmatched: ${unmatched.length}`);

		// Build order items — include both matched and unmatched
		const orderItems = prescription.medicines.map(med => {
			// Find the match for this medicine
			const match = matched.find(m =>
				m.originalName.toLowerCase() === med.name.toLowerCase() ||
				m.inventoryItem.name?.toLowerCase().includes(med.name.split(/\s+/)[0].toLowerCase())
			);

			const inventoryItem = match?.inventoryItem || null;
			const qty           = med.quantity || 1;

			return {
				medicineId:   inventoryItem?._id   || null,
				name:         med.name,
				dosage:       med.dosage            || '',
				quantity:     qty,
				unitPrice:    inventoryItem?.price  || 0,
				lineTotal:    (inventoryItem?.price || 0) * qty,
				deselected:   false,
				inStock:      inventoryItem ? (inventoryItem.stock >= qty) : false,
				// Helpful UI metadata
				matchLayer:   match?.matchLayer     || 0,   // 0 = not found
				matchedName:  inventoryItem?.name   || null // what inventory calls it
			};
		});

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

		const matchedCount   = orderItems.filter(i => i.medicineId).length;
		const unmatchedCount = orderItems.filter(i => !i.medicineId).length;

		console.log(`[PHARMACY] Auto-cart created: ${order._id} | matched: ${matchedCount}/${orderItems.length}`);

		res.status(201).json({
			success: true,
			message: `Auto-cart created with ${orderItems.length} items (${matchedCount} matched in inventory${unmatchedCount > 0 ? `, ${unmatchedCount} not found` : ''}).`,
			data: {
				orderId:       order._id,
				patientName:   prescription.patientId.name,
				itemCount:     orderItems.length,
				matchedCount,
				unmatchedCount,
				total,
				itemsInStock:  orderItems.filter(i => i.inStock).length
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
		const { orderId }                   = req.params;
		const { medicineIndex, deselected } = req.body;
		const patientId                     = req.user.userId;

		if (medicineIndex === undefined || deselected === undefined) {
			return res.status(400).json({ success: false, error: "medicineIndex and deselected are required." });
		}

		const order = await PharmacyOrderModel.findById(orderId);
		if (!order) {
			return res.status(404).json({ success: false, error: "Order not found." });
		}

		if (order.patientId.toString() !== patientId) {
			return res.status(403).json({ success: false, error: "Unauthorized." });
		}

		if (order.status !== "pending_patient_review") {
			return res.status(400).json({ success: false, error: "Order can only be edited while in 'pending_patient_review' status." });
		}

		if (medicineIndex < 0 || medicineIndex >= order.medicines.length) {
			return res.status(400).json({ success: false, error: "Invalid medicine index." });
		}

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
				medicines: order.medicines,
				newTotal:  order.total
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
		const { orderId }                     = req.params;
		const { deliveryOption, deliveryAddress } = req.body;
		const patientId                       = req.user.userId;

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
		order.deliveryOption  = deliveryOption  || order.deliveryOption;
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
		if      (userRole === "PATIENT")  filter.patientId = userId;
		else if (userRole === "DOCTOR")   filter.doctorId  = userId;
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
		if (status === "delivered")  update.deliveredAt = new Date();
		if (status === "processing") update.processedAt = new Date();

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
