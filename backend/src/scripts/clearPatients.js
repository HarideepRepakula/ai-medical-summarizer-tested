import dotenv from "dotenv";
import mongoose from "mongoose";
import { UserModel } from "../models/User.js";
import { AppointmentModel } from "../models/Appointment.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/medhub";

async function clearPatientData() {
	try {
		await mongoose.connect(mongoUri);
		console.log('Connected to MongoDB');
		
		// Find all patient users first
		const patients = await UserModel.find({ role: "PATIENT" });
		const patientIds = patients.map(patient => patient._id);
		
		console.log(`Found ${patients.length} patients to delete:`);
		patients.forEach(patient => {
			console.log(`- ${patient.name} (${patient.email || patient.phone})`);
		});
		
		if (patients.length === 0) {
			console.log('No patients found to delete.');
			process.exit(0);
		}
		
		// Delete all appointments related to these patients
		const appointmentDeleteResult = await AppointmentModel.deleteMany({
			$or: [
				{ patientId: { $in: patientIds } },
				// Also delete appointments where patient is the doctor (shouldn't happen, but safety)
				{ doctorId: { $in: patientIds } }
			]
		});
		
		console.log(`Deleted ${appointmentDeleteResult.deletedCount} appointments related to patients`);
		
		// Delete all patient users
		const userDeleteResult = await UserModel.deleteMany({ role: "PATIENT" });
		console.log(`Deleted ${userDeleteResult.deletedCount} patient users`);
		
		// Verify remaining users
		const remainingUsers = await UserModel.find({}, 'name email role');
		console.log('\nRemaining users in system:');
		remainingUsers.forEach(user => {
			console.log(`- ${user.name} (${user.email}) - ${user.role}`);
		});
		
		console.log('\n✅ Patient data cleared successfully!');
		console.log('You can now create new patient accounts.');
		
		process.exit(0);
	} catch (error) {
		console.error('❌ Error clearing patient data:', error);
		process.exit(1);
	}
}

clearPatientData();