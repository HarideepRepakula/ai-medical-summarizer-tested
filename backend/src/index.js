import dotenv from "dotenv";
import mongoose from "mongoose";
import { createServer } from "http";
import app from "./app.js";

dotenv.config();

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/medhub";

async function bootstrap() {
	try {
		await mongoose.connect(mongoUri);
		console.log('Connected to MongoDB');
		
		const server = createServer(app);
		server.timeout = 120000; // 2 minutes for long-running AI requests
		server.listen(port, () => {
			console.log(`MedHub API running on http://localhost:${port}`);
		});
		
		// Graceful shutdown
		process.on('SIGTERM', async () => {
			console.log('SIGTERM received, shutting down gracefully');
			server.close(() => {
				mongoose.connection.close(false, () => {
					console.log('MongoDB connection closed');
					process.exit(0);
				});
			});
		});
		
		process.on('SIGINT', async () => {
			console.log('SIGINT received, shutting down gracefully');
			server.close(() => {
				mongoose.connection.close(false, () => {
					console.log('MongoDB connection closed');
					process.exit(0);
				});
			});
		});
		
	} catch (error) {
		console.error("Failed to start server", error);
		process.exit(1);
	}
}

bootstrap();





