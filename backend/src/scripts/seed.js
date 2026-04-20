import dotenv from "dotenv";
import mongoose from "mongoose";
import { authService } from "../services/authService.js";
import { UserModel } from "../models/User.js";
import { DoctorModel } from "../models/Doctor.js";
import { InventoryModel } from "../models/Inventory.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/medhub";

// ── Specialties must exactly match DoctorModel enum ──────────────────────────
const sampleDoctors = [
	{ name: "Dr. Sarah Johnson",  email: "sarah.johnson@medhub.com",  phone: "+1-555-0101", specialty: "Cardiology",       experience: "10 years", consultationFee: 150, password: "Doctor123!" },
	{ name: "Dr. Michael Chen",   email: "michael.chen@medhub.com",   phone: "+1-555-0102", specialty: "Dermatology",      experience: "8 years",  consultationFee: 120, password: "Doctor123!" },
	{ name: "Dr. Emily Davis",    email: "emily.davis@medhub.com",    phone: "+1-555-0103", specialty: "Pediatrics",       experience: "12 years", consultationFee: 130, password: "Doctor123!" },
	{ name: "Dr. Robert Wilson",  email: "robert.wilson@medhub.com",  phone: "+1-555-0104", specialty: "Orthopedics",      experience: "15 years", consultationFee: 180, password: "Doctor123!" },
	{ name: "Dr. Priya Sharma",   email: "priya.sharma@medhub.com",   phone: "+1-555-0105", specialty: "General Physician",experience: "6 years",  consultationFee: 100, password: "Doctor123!" },
	{ name: "Dr. James Nguyen",   email: "james.nguyen@medhub.com",   phone: "+1-555-0106", specialty: "Neurology",        experience: "11 years", consultationFee: 200, password: "Doctor123!" },
];

// ── Inventory — matches InventoryModel category enum exactly ─────────────────
const sampleInventory = [
	// Analgesics
	{ name: "Paracetamol 500mg",    genericName: "Acetaminophen",  brand: "Calpol",    category: "Analgesic", image: "https://images.unsplash.com/photo-1550572017-ed20015dd085?w=400",      dosageStrength: "500mg",  unit: "tablet",  stock: 500, price: 5,   manufacturer: "GSK" },
	{ name: "Ibuprofen 400mg",      genericName: "Ibuprofen",      brand: "Brufen",    category: "Analgesic", image: "https://images.unsplash.com/photo-1550572017-ed20015dd085?w=400",      dosageStrength: "400mg",  unit: "tablet",  stock: 300, price: 8,   manufacturer: "Abbott" },
	{ name: "Aspirin 75mg",         genericName: "Aspirin",        brand: "Disprin",   category: "Cardiovascular", image: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400", dosageStrength: "75mg",   unit: "tablet",  stock: 400, price: 4,   manufacturer: "Bayer" },

	// Antibiotics
	{ name: "Amoxicillin 250mg",    genericName: "Amoxicillin",    brand: "Amoxil",    category: "Antibiotics", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",    dosageStrength: "250mg",  unit: "capsule", stock: 200, price: 12,  manufacturer: "Cipla" },
	{ name: "Amoxicillin 500mg",    genericName: "Amoxicillin",    brand: "Amoxil",    category: "Antibiotics", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",    dosageStrength: "500mg",  unit: "capsule", stock: 150, price: 18,  manufacturer: "Cipla" },
	{ name: "Azithromycin 500mg",   genericName: "Azithromycin",   brand: "Zithromax", category: "Antibiotics", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",    dosageStrength: "500mg",  unit: "tablet",  stock: 100, price: 25,  manufacturer: "Pfizer" },
	{ name: "Ciprofloxacin 500mg",  genericName: "Ciprofloxacin",  brand: "Ciplox",    category: "Antibiotics", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",    dosageStrength: "500mg",  unit: "tablet",  stock: 120, price: 20,  manufacturer: "Cipla" },

	// Antihistamines
	{ name: "Cetirizine 10mg",      genericName: "Cetirizine",     brand: "Zyrtec",    category: "Antihistamine", image: "https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400",  dosageStrength: "10mg",   unit: "tablet",  stock: 350, price: 8,   manufacturer: "UCB" },
	{ name: "Loratadine 10mg",      genericName: "Loratadine",     brand: "Claritin",  category: "Antihistamine", image: "https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400",  dosageStrength: "10mg",   unit: "tablet",  stock: 250, price: 10,  manufacturer: "Bayer" },

	// Cardiovascular
	{ name: "Amlodipine 5mg",       genericName: "Amlodipine",     brand: "Norvasc",   category: "Cardiovascular", image: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400", dosageStrength: "5mg",    unit: "tablet",  stock: 200, price: 15,  manufacturer: "Pfizer" },
	{ name: "Metoprolol 50mg",      genericName: "Metoprolol",     brand: "Lopressor", category: "Cardiovascular", image: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400", dosageStrength: "50mg",   unit: "tablet",  stock: 180, price: 22,  manufacturer: "Novartis" },
	{ name: "Atorvastatin 10mg",    genericName: "Atorvastatin",   brand: "Lipitor",   category: "Cholesterol", image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400",    dosageStrength: "10mg",   unit: "tablet",  stock: 220, price: 30,  manufacturer: "Pfizer" },

	// Diabetes
	{ name: "Metformin 500mg",      genericName: "Metformin",      brand: "Glucophage",category: "Diabetes", image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400",       dosageStrength: "500mg",  unit: "tablet",  stock: 300, price: 10,  manufacturer: "Merck" },
	{ name: "Metformin 1000mg",     genericName: "Metformin",      brand: "Glucophage",category: "Diabetes", image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400",       dosageStrength: "1000mg", unit: "tablet",  stock: 200, price: 18,  manufacturer: "Merck" },
	{ name: "Glibenclamide 5mg",    genericName: "Glibenclamide",  brand: "Daonil",    category: "Diabetes", image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400",       dosageStrength: "5mg",    unit: "tablet",  stock: 150, price: 12,  manufacturer: "Sanofi" },

	// Gastric
	{ name: "Omeprazole 20mg",      genericName: "Omeprazole",     brand: "Prilosec",  category: "Gastric", image: "https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400",        dosageStrength: "20mg",   unit: "capsule", stock: 280, price: 14,  manufacturer: "AstraZeneca" },
	{ name: "Pantoprazole 40mg",    genericName: "Pantoprazole",   brand: "Protonix",  category: "Gastric", image: "https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400",        dosageStrength: "40mg",   unit: "tablet",  stock: 200, price: 18,  manufacturer: "Pfizer" },
	{ name: "Domperidone 10mg",     genericName: "Domperidone",    brand: "Motilium",  category: "Gastric", image: "https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400",        dosageStrength: "10mg",   unit: "tablet",  stock: 180, price: 9,   manufacturer: "Janssen" },

	// Vitamins
	{ name: "Vitamin D3 1000IU",    genericName: "Cholecalciferol",brand: "D-Rise",    category: "Vitamins", image: "https://images.unsplash.com/photo-1471864190281-ad5f9f07ce4a?w=400",       dosageStrength: "1000IU", unit: "capsule", stock: 400, price: 20,  manufacturer: "Sun Pharma" },
	{ name: "Vitamin B12 500mcg",   genericName: "Cyanocobalamin", brand: "Neurobion", category: "Vitamins", image: "https://images.unsplash.com/photo-1471864190281-ad5f9f07ce4a?w=400",       dosageStrength: "500mcg", unit: "tablet",  stock: 300, price: 15,  manufacturer: "Merck" },
	{ name: "Folic Acid 5mg",       genericName: "Folic Acid",     brand: "Folvite",   category: "Vitamins", image: "https://images.unsplash.com/photo-1471864190281-ad5f9f07ce4a?w=400",       dosageStrength: "5mg",    unit: "tablet",  stock: 350, price: 6,   manufacturer: "Pfizer" },
];

async function seedDatabase() {
	try {
		await mongoose.connect(mongoUri);
		console.log("Connected to MongoDB");

		// Clear existing data
		await UserModel.deleteMany({});
		await DoctorModel.deleteMany({});
		await InventoryModel.deleteMany({});
		console.log("Cleared existing data");

		// ── Seed Doctors ──────────────────────────────────────────────────────
		for (const doctorData of sampleDoctors) {
			const passwordHash = await authService.hashPassword(doctorData.password);

			const user = await UserModel.create({
				name:         doctorData.name,
				email:        doctorData.email,
				phone:        doctorData.phone,
				passwordHash,
				role:         "DOCTOR",
				isActive:     true
			});

			await DoctorModel.create({
				userId:          user._id,
				specialty:       doctorData.specialty,
				experience:      doctorData.experience,
				consultationFee: doctorData.consultationFee,
				rating:          parseFloat((4.5 + Math.random() * 0.5).toFixed(1)),
				// Pre-verified for seed data — bypasses AI Admin for demo accounts
				isVerified:         true,
				verificationStatus: "approved",
				verificationScore:  95,
				adminNote:          "Pre-verified seed account",
				verifiedAt:         new Date(),
				availability: [
					{ day: "Monday",    startTime: "09:00", endTime: "17:00" },
					{ day: "Tuesday",   startTime: "09:00", endTime: "17:00" },
					{ day: "Wednesday", startTime: "09:00", endTime: "17:00" },
					{ day: "Thursday",  startTime: "09:00", endTime: "17:00" },
					{ day: "Friday",    startTime: "09:00", endTime: "17:00" }
				]
			});

			console.log(`✓ Doctor: ${doctorData.name} (${doctorData.specialty})`);
		}

		// ── Seed Admin ────────────────────────────────────────────────────────
		const adminHash = await authService.hashPassword("Admin123!");
		await UserModel.create({
			name: "Admin User", email: "admin@medhub.com", phone: "+1-555-0001",
			passwordHash: adminHash, role: "ADMIN", isActive: true
		});
		console.log("✓ Admin: admin@medhub.com");

		// ── Seed Inventory ────────────────────────────────────────────────────
		await InventoryModel.insertMany(sampleInventory);
		console.log(`✓ Inventory: ${sampleInventory.length} medicines seeded`);

		console.log("\n🎉 Database seeded successfully!\n");
		console.log("📋 Demo Accounts:");
		console.log("   Admin:   admin@medhub.com        / Admin123!");
		console.log("   Doctor:  sarah.johnson@medhub.com / Doctor123!");
		console.log("   Nurse:   jane.smith@medhub.com   / Nurse123!");
		console.log("   Patient: Create via signup form");
		console.log("\n💊 Inventory: 21 medicines across 8 categories");
		console.log("🏥 Doctors: 6 verified doctors across 6 specialties\n");

		process.exit(0);
	} catch (error) {
		console.error("Seed error:", error);
		process.exit(1);
	}
}

seedDatabase();
