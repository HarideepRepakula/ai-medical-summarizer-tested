import dotenv from "dotenv";
import mongoose from "mongoose";
import { UserModel } from "../models/User.js";
import { AppointmentModel } from "../models/Appointment.js";
import { DoctorModel } from "../models/Doctor.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/medhub";

async function clearAllUserData() {
	try {
		await mongoose.connect(mongoUri);
		console.log('Connected to MongoDB');
		
		// Show current data before deletion
		const allUsers = await UserModel.find({}, 'name email role');
		const allAppointments = await AppointmentModel.find({});
		const allDoctors = await DoctorModel.find({});
		
		console.log(`Current data in system:`);
		console.log(`- Users: ${allUsers.length}`);
		console.log(`- Appointments: ${allAppointments.length}`);
		console.log(`- Doctor profiles: ${allDoctors.length}`);
		
		// Clear all collections
		await AppointmentModel.deleteMany({});
		console.log('✅ Cleared all appointments');
		
		await DoctorModel.deleteMany({});
		console.log('✅ Cleared all doctor profiles');
		
		await UserModel.deleteMany({});
		console.log('✅ Cleared all users');
		
		console.log('\n🔥 ALL USER DATA CLEARED!');
		console.log('You can now run the seed script to recreate sample data:');
		console.log('npm run seed');
		
		process.exit(0);
	} catch (error) {
		console.error('❌ Error clearing all data:', error);
		process.exit(1);
	}
}

clearAllUserData();