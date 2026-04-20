import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/medhub";

async function dropDatabase() {
	try {
		await mongoose.connect(mongoUri);
		console.log('Connected to MongoDB');
		
		await mongoose.connection.db.dropDatabase();
		console.log('Database dropped successfully');
		
		process.exit(0);
	} catch (error) {
		console.error('Drop error:', error);
		process.exit(1);
	}
}

dropDatabase();