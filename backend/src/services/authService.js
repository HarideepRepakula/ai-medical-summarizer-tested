import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User.js";
import { RefreshTokenModel } from "../models/RefreshToken.js";

class AuthService {
	constructor() {
		this.ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret-key';
		this.REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
		this.ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
		this.REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
		this.BCRYPT_ROUNDS = 12; // Increased from default 10
	}

	// Generate cryptographically secure token family ID
	generateTokenFamily() {
		return crypto.randomBytes(32).toString('hex');
	}

	// Generate access token (short-lived, stateless)
	generateAccessToken(payload) {
		return jwt.sign(
			{
				userId: payload.userId,
				role: payload.role,
				email: payload.email,
				name: payload.name,
				tokenType: 'access',
				iat: Math.floor(Date.now() / 1000)
			},
			this.ACCESS_TOKEN_SECRET,
			{ 
				expiresIn: this.ACCESS_TOKEN_EXPIRY,
				issuer: 'medhub-api',
				audience: 'medhub-client'
			}
		);
	}

	// Generate refresh token (long-lived, stored in DB)
	generateRefreshToken(payload) {
		const jti = crypto.randomBytes(32).toString('hex'); // Unique token ID
		
		return jwt.sign(
			{
				userId: payload.userId,
				tokenFamily: payload.tokenFamily,
				jti,
				tokenType: 'refresh',
				iat: Math.floor(Date.now() / 1000)
			},
			this.REFRESH_TOKEN_SECRET,
			{ 
				expiresIn: this.REFRESH_TOKEN_EXPIRY,
				issuer: 'medhub-api',
				audience: 'medhub-client'
			}
		);
	}

	// Verify access token
	verifyAccessToken(token) {
		try {
			const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
				issuer: 'medhub-api',
				audience: 'medhub-client'
			});
			
			if (decoded.tokenType !== 'access') {
				throw new Error('Invalid token type');
			}
			
			return decoded;
		} catch (error) {
			throw new Error(`Access token verification failed: ${error.message}`);
		}
	}

	// Verify refresh token
	verifyRefreshToken(token) {
		try {
			const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
				issuer: 'medhub-api',
				audience: 'medhub-client'
			});
			
			if (decoded.tokenType !== 'refresh') {
				throw new Error('Invalid token type');
			}
			
			return decoded;
		} catch (error) {
			throw new Error(`Refresh token verification failed: ${error.message}`);
		}
	}

	// Enhanced password hashing with timing attack protection
	async hashPassword(password) {
		// Validate password strength
		if (!this.isPasswordStrong(password)) {
			throw new Error('Password does not meet security requirements');
		}
		
		// Add random delay to prevent timing attacks
		await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
		
		return bcrypt.hash(password, this.BCRYPT_ROUNDS);
	}

	// Password strength validation
	isPasswordStrong(password) {
		const minLength = 8;
		const hasUpperCase = /[A-Z]/.test(password);
		const hasLowerCase = /[a-z]/.test(password);
		const hasNumbers = /\d/.test(password);
		const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
		
		return password.length >= minLength && 
			   hasUpperCase && 
			   hasLowerCase && 
			   hasNumbers && 
			   hasSpecialChar;
	}

	// Secure password comparison with timing attack protection
	async comparePassword(plainPassword, hashedPassword) {
		// Add random delay to prevent timing attacks
		await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
		
		return bcrypt.compare(plainPassword, hashedPassword);
	}

	// Create refresh token in database
	async createRefreshToken(userId, tokenFamily, token, ipAddress, userAgent) {
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
		
		return RefreshTokenModel.create({
			userId,
			token,
			tokenFamily,
			expiresAt,
			ipAddress,
			userAgent
		});
	}

	// Validate refresh token from database
	async validateRefreshToken(token) {
		const refreshTokenDoc = await RefreshTokenModel.findOne({
			token,
			isRevoked: false,
			expiresAt: { $gt: new Date() }
		}).populate('userId', 'name email role isActive');

		if (!refreshTokenDoc) {
			throw new Error('Invalid or expired refresh token');
		}

		// Update last used timestamp
		refreshTokenDoc.lastUsedAt = new Date();
		await refreshTokenDoc.save();

		return refreshTokenDoc;
	}

	// Token rotation: Generate new token pair and revoke old refresh token
	async rotateTokens(oldRefreshToken, ipAddress, userAgent) {
		const refreshTokenDoc = await this.validateRefreshToken(oldRefreshToken);
		const user = refreshTokenDoc.userId;

		if (!user) {
			throw new Error('User account no longer exists');
		}

		if (!user.isActive) {
			throw new Error('User account is deactivated');
		}

		// Generate new token family for rotation
		const newTokenFamily = this.generateTokenFamily();
		
		// Generate new tokens
		const accessToken = this.generateAccessToken({
			userId: user._id,
			role: user.role,
			email: user.email
		});

		const refreshToken = this.generateRefreshToken({
			userId: user._id,
			tokenFamily: newTokenFamily
		});

		// Create new refresh token in database
		await this.createRefreshToken(
			user._id,
			newTokenFamily,
			refreshToken,
			ipAddress,
			userAgent
		);

		// Revoke old refresh token
		refreshTokenDoc.isRevoked = true;
		refreshTokenDoc.revokedAt = new Date();
		refreshTokenDoc.revokedReason = 'token_rotation';
		await refreshTokenDoc.save();

		return {
			accessToken,
			refreshToken,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role
			}
		};
	}

	// Detect token reuse (security breach)
	async detectTokenReuse(tokenFamily) {
		const revokedTokens = await RefreshTokenModel.find({
			tokenFamily,
			isRevoked: true,
			revokedReason: { $in: ['token_rotation', 'logout'] }
		});

		if (revokedTokens.length > 0) {
			// Token reuse detected - revoke entire token family
			await RefreshTokenModel.revokeTokenFamily(tokenFamily, 'token_reuse');
			
			// Log security incident
			console.error(`[SECURITY] Token reuse detected for family: ${tokenFamily}`);
			
			throw new Error('Token reuse detected. All sessions have been terminated for security.');
		}
	}

	// Logout: Revoke specific refresh token
	async logout(refreshToken) {
		const refreshTokenDoc = await RefreshTokenModel.findOne({ token: refreshToken });
		
		if (refreshTokenDoc && !refreshTokenDoc.isRevoked) {
			refreshTokenDoc.isRevoked = true;
			refreshTokenDoc.revokedAt = new Date();
			refreshTokenDoc.revokedReason = 'logout';
			await refreshTokenDoc.save();
		}
	}

	// Logout from all devices: Revoke all refresh tokens for user
	async logoutAllDevices(userId) {
		await RefreshTokenModel.revokeAllForUser(userId, 'logout');
	}

	// Get user's active sessions
	async getActiveSessions(userId) {
		return RefreshTokenModel.find({
			userId,
			isRevoked: false,
			expiresAt: { $gt: new Date() }
		}).select('createdAt lastUsedAt ipAddress userAgent').sort({ lastUsedAt: -1 });
	}

	// Clean up expired tokens (run periodically)
	async cleanupExpiredTokens() {
		const result = await RefreshTokenModel.cleanupExpired();
		console.log(`[CLEANUP] Removed ${result.deletedCount} expired/revoked tokens`);
		return result;
	}

	// Generate secure cookie options
	getRefreshTokenCookieOptions() {
		return {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production', // HTTPS only in production
			sameSite: 'strict',
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			path: '/api/auth' // Restrict cookie to auth endpoints only
		};
	}
}

export const authService = new AuthService();