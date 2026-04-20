import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Enhanced security middleware
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			scriptSrc: ["'self'"],
			imgSrc: ["'self'", "data:", "https:", "http://localhost:4000"],
			connectSrc: ["'self'", "http://localhost:4000"],
			fontSrc: ["'self'"],
			objectSrc: ["'none'"],
			mediaSrc: ["'self'"],
			frameSrc: ["'none'"]
		}
	},
	hsts: {
		maxAge: 31536000,
		includeSubDomains: true,
		preload: true
	}
}));

// CORS configuration for production security
const corsOptions = {
	origin: process.env.NODE_ENV === 'production' 
		? process.env.FRONTEND_URL || 'http://localhost:5173'
		: ['http://localhost:5173', 'http://localhost:3000'],
	credentials: true, // Allow cookies
	optionsSuccessStatus: 200,
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
};

app.use(cors(corsOptions));
app.use(cookieParser()); // Parse cookies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Sanitize user input to prevent NoSQL injection
app.use((req, _res, next) => {
	if (req.body && typeof req.body === 'object') {
		const sanitize = (obj) => {
			for (const key of Object.keys(obj)) {
				if (key.startsWith('$') || key.includes('.')) { delete obj[key]; continue; }
				if (obj[key] && typeof obj[key] === 'object') sanitize(obj[key]);
			}
		};
		sanitize(req.body);
	}
	next();
});

app.get("/", (_req, res) => {
	res.json({ 
		name: "MedHub API", 
		tagline: "Your Health, Our Priority",
		version: "2.0.0",
		security: "Enhanced with dual-token authentication"
	});
});

// Serve uploaded medical records as static files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", routes);

// Global error handling middleware
app.use((err, req, res, next) => {
	const errorId = Date.now();
	console.error(`[ERROR-${errorId}] ${new Date().toISOString()}`);
	console.error(`[ERROR-${errorId}] ${req.method} ${req.path}`);
	console.error(`[ERROR-${errorId}] User: ${req.user?.userId || 'anonymous'}`);
	console.error(`[ERROR-${errorId}] Error:`, err.message);
	console.error(`[ERROR-${errorId}] Stack:`, err.stack);
	
	res.status(err.status || 500).json({
		error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
		errorId: errorId
	});
});

// 404 handler
app.use('*', (req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

export default app;





