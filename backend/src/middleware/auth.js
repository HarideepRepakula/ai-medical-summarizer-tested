import { authService } from '../services/authService.js';
import { UserModel } from '../models/User.js';
import rateLimit from 'express-rate-limit';

// Rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // 5 attempts per window
	message: {
		error: 'Too many authentication attempts. Please try again in 15 minutes.',
		retryAfter: 15 * 60
	},
	standardHeaders: true,
	legacyHeaders: false,
	// Custom key generator to include IP and user identifier
	keyGenerator: (req) => {
		const identifier = req.body?.identifier || req.body?.email || 'anonymous';
		return `${req.ip}-${identifier}`;
	},
	// Skip successful requests
	skipSuccessfulRequests: true
});

// Enhanced authentication middleware with detailed logging
export async function authenticate(req, res, next) {
	const requestId = Date.now();
	console.log(`[AUTH-${requestId}] ${new Date().toISOString()} - ${req.method} ${req.path}`);
	console.log(`[AUTH-${requestId}] IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
	
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith('Bearer ')) {
			console.log(`[AUTH-${requestId}] No valid authorization header`);
			return res.status(401).json({ 
				error: 'Authentication required',
				code: 'NO_TOKEN'
			});
		}

		const accessToken = authHeader.substring(7);
		console.log(`[AUTH-${requestId}] Attempting to verify access token`);
		
		// Verify access token using auth service
		const decoded = authService.verifyAccessToken(accessToken);
		console.log(`[AUTH-${requestId}] Token valid for userId: ${decoded.userId}, role: ${decoded.role}`);
		
		// Verify user still exists and is active
		const user = await UserModel.findById(decoded.userId).select('role name email phone isActive passwordChangedAt');
		if (!user) {
			console.log(`[AUTH-${requestId}] User not found in database`);
			return res.status(401).json({ 
				error: 'User not found',
				code: 'USER_NOT_FOUND'
			});
		}
		
		if (!user.isActive) {
			console.log(`[AUTH-${requestId}] User account is deactivated`);
			return res.status(401).json({ 
				error: 'Account deactivated',
				code: 'ACCOUNT_DEACTIVATED'
			});
		}
		
		// Check if password was changed after token was issued
		const tokenIssuedAt = new Date(decoded.iat * 1000);
		if (user.passwordChangedAt && user.passwordChangedAt > tokenIssuedAt) {
			console.log(`[AUTH-${requestId}] Token issued before password change`);
			return res.status(401).json({ 
				error: 'Token invalidated due to password change',
				code: 'PASSWORD_CHANGED'
			});
		}

		req.user = {
			userId: decoded.userId,
			role: user.role,
			name: user.name,
			email: user.email,
			phone: user.phone
		};
		
		console.log(`[AUTH-${requestId}] Authentication successful for ${user.email}`);
		next();
	} catch (error) {
		console.error(`[AUTH-${requestId}] Authentication failed: ${error.message}`);
		
		// Determine error type for appropriate response
		if (error.message.includes('expired')) {
			return res.status(401).json({ 
				error: 'Access token expired',
				code: 'TOKEN_EXPIRED'
			});
		}
		
		if (error.message.includes('invalid')) {
			return res.status(401).json({ 
				error: 'Invalid access token',
				code: 'INVALID_TOKEN'
			});
		}
		
		return res.status(401).json({ 
			error: 'Authentication failed',
			code: 'AUTH_FAILED'
		});
	}
}

// Optional authentication middleware (for public endpoints that can benefit from user context)
export async function optionalAuthenticate(req, res, next) {
	try {
		const authHeader = req.headers.authorization;
		if (authHeader?.startsWith('Bearer ')) {
			const accessToken = authHeader.substring(7);
			const decoded = authService.verifyAccessToken(accessToken);
			
			const user = await UserModel.findById(decoded.userId).select('role name email phone isActive');
			if (user && user.isActive) {
				req.user = {
					userId: decoded.userId,
					role: user.role,
					name: user.name,
					email: user.email,
					phone: user.phone
				};
			}
		}
	} catch (error) {
		// Silently fail for optional authentication
		console.log(`[OPTIONAL-AUTH] Failed: ${error.message}`);
	}
	
	next();
}
