import dotenv from "dotenv";
import mongoose from "mongoose";
import { authService } from "../services/authService.js";
import { UserModel } from "../models/User.js";
import { DoctorModel } from "../models/Doctor.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/medhub";

const sampleDoctors = [
	{
		name: "Dr. Sarah Johnson",
		email: "sarah.johnson@medhub.com",
		phone: "+1-555-0101",
		specialty: "Cardiology",
		experience: "10 years",
		consultationFee: 150,
		password: "Doctor123!" // Strong password
	},
	{
		name: "Dr. Michael Chen",
		email: "michael.chen@medhub.com",
		phone: "+1-555-0102",
		specialty: "Dermatology",
		experience: "8 years",
		consultationFee: 120,
		password: "Doctor123!"
	},
	{
		name: "Dr. Emily Davis",
		email: "emily.davis@medhub.com",
		phone: "+1-555-0103",
		specialty: "Pediatrics",
		experience: "12 years",
		consultationFee: 130,
		password: "Doctor123!"
	},
	{
		name: "Dr. Robert Wilson",
		email: "robert.wilson@medhub.com",
		phone: "+1-555-0104",
		specialty: "Orthopedics",
		experience: "15 years",
		consultationFee: 180,
		password: "Doctor123!"
	}
];

async function seedDatabase() {
	try {
		await mongoose.connect(mongoUri);
		console.log('Connected to MongoDB');

		await UserModel.deleteMany({});
		await DoctorModel.deleteMany({});
		console.log('Cleared existing data');

		// Create doctors with enhanced security
		for (const doctorData of sampleDoctors) {
			const passwordHash = await authService.hashPassword(doctorData.password);
			
			const user = await UserModel.create({
				name: doctorData.name,
				email: doctorData.email,
				phone: doctorData.phone,
				passwordHash,
				role: "DOCTOR",
				isActive: true
			});

			await DoctorModel.create({
				userId: user._id,
				specialty: doctorData.specialty,
				experience: doctorData.experience,
				consultationFee: doctorData.consultationFee,
				rating: 4.5 + Math.random() * 0.5,
				availability: [
					{ day: 'Monday', startTime: '09:00', endTime: '17:00' },
					{ day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
					{ day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
					{ day: 'Thursday', startTime: '09:00', endTime: '17:00' },
					{ day: 'Friday', startTime: '09:00', endTime: '17:00' }
				]
			});
			
			console.log(`✓ Created doctor: ${doctorData.name}`);
		}

		// Create admin with strong password
		const adminPasswordHash = await authService.hashPassword("Admin123!");
		await UserModel.create({
			name: "Admin User",
			email: "admin@medhub.com",
			phone: "+1-555-0001",
			passwordHash: adminPasswordHash,
			role: "ADMIN",
			isActive: true
		});
		console.log('✓ Created admin user');

		// Create nurse with strong password
		const nursePasswordHash = await authService.hashPassword("Nurse123!");
		await UserModel.create({
			name: "Jane Smith",
			email: "jane.smith@medhub.com",
			phone: "+1-555-0003",
			passwordHash: nursePasswordHash,
			role: "NURSE",
			isActive: true
		});
		console.log('✓ Created nurse user');

		console.log('\n🔐 Sample accounts created with enhanced security:');
		console.log('Admin: admin@medhub.com / Admin123!');
		console.log('Doctor: sarah.johnson@medhub.com / Doctor123!');
		console.log('Nurse: jane.smith@medhub.com / Nurse123!');
		console.log('\n⚠️  Please create patient accounts through the signup form');
		console.log('   (Patients require strong passwords meeting security requirements)');
		
		process.exit(0);
	} catch (error) {
		console.error('Seed error:', error);
		process.exit(1);
	}
}

seedDatabase();