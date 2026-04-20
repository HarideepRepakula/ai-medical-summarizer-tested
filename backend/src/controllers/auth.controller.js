import { authService } from "../services/authService.js";
import { UserModel } from "../models/User.js";
import { RefreshTokenModel } from "../models/RefreshToken.js";
import { USER_ROLES } from "../types/roles.js";

function getClientInfo(req) {
	return {
		ipAddress: req.ip || req.connection.remoteAddress,
		userAgent: req.get('User-Agent') || 'Unknown'
	};
}

export async function signup(req, res) {
	const requestId = Date.now();
	try {
		const { name, phone, email, password, role, specialty, experience, consultationFee } = req.body || {};

		if (!name || !phone || !password || !role) {
			return res.status(400).json({ error: "Missing required fields", required: ["name","phone","password","role"] });
		}
		if (!USER_ROLES.includes(role)) {
			return res.status(400).json({ error: "Invalid role", allowedRoles: USER_ROLES });
		}

		const existingUser = await UserModel.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] });
		if (existingUser) {
			return res.status(409).json({ error: "User already exists with this phone or email" });
		}

		const passwordHash = await authService.hashPassword(password);
		const user = await UserModel.create({ name, phone, email, passwordHash, role, lastLoginIP: req.ip });

		console.log(`[SIGNUP-${requestId}] User created: ${user._id} role=${role}`);

		// Auto-create DoctorModel profile so getDoctors() returns this doctor immediately
		if (role === 'DOCTOR') {
			const { DoctorModel } = await import('../models/Doctor.js');
			await DoctorModel.create({
				userId:          user._id,
				specialty:       specialty?.trim()       || 'General Practice',
				experience:      experience?.trim()      || '1+ years',
				consultationFee: Number(consultationFee) || 500,
				rating:          4.5,
				availability: [
					{ day: 'Monday',    startTime: '09:00', endTime: '17:00' },
					{ day: 'Tuesday',   startTime: '09:00', endTime: '17:00' },
					{ day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
					{ day: 'Thursday',  startTime: '09:00', endTime: '17:00' },
					{ day: 'Friday',    startTime: '09:00', endTime: '17:00' }
				]
			});
			console.log(`[SIGNUP-${requestId}] DoctorModel profile created for ${user._id}`);
		}

		const tokenFamily  = authService.generateTokenFamily();
		const accessToken  = authService.generateAccessToken({ userId: user._id, role: user.role, email: user.email, name: user.name });
		const refreshToken = authService.generateRefreshToken({ userId: user._id, tokenFamily });

		const { ipAddress, userAgent } = getClientInfo(req);
		await authService.createRefreshToken(user._id, tokenFamily, refreshToken, ipAddress, userAgent);

		res.cookie('refreshToken', refreshToken, authService.getRefreshTokenCookieOptions());

		return res.status(201).json({
			accessToken,
			user: { id: user._id, name, phone, email, role },
			tokenExpiry: '15m'
		});

	} catch (error) {
		console.error(`[SIGNUP-${requestId}] Error:`, error.message);
		if (error.code === 11000) return res.status(409).json({ error: "User already exists" });
		if (error.message.includes('Password does not meet')) {
			return res.status(400).json({
				error: error.message,
				requirements: { minLength: 8, requires: ['uppercase','lowercase','number','special character'] }
			});
		}
		return res.status(500).json({ error: "Registration failed" });
	}
}

export async function login(req, res) {
	const requestId = Date.now();
	try {
		const { identifier, password } = req.body || {};
		if (!identifier || !password) return res.status(400).json({ error: "Missing credentials" });

		const user = await UserModel.findOne({ $or: [{ phone: identifier }, { email: identifier }] });
		if (!user) return res.status(404).json({ error: "User not registered", showSignup: true });
		if (user.isLocked) return res.status(423).json({ error: "Account temporarily locked", lockUntil: user.lockUntil });
		if (!user.isActive) return res.status(403).json({ error: "Account has been deactivated. Contact support." });
		if (!user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

		const isValid = await authService.comparePassword(password, user.passwordHash);
		if (!isValid) {
			await user.incLoginAttempts();
			return res.status(401).json({ error: "Invalid credentials" });
		}

		if (user.failedLoginAttempts > 0) await user.resetLoginAttempts();
		user.lastLoginAt = new Date();
		user.lastLoginIP = req.ip;
		await user.save();

		const tokenFamily  = authService.generateTokenFamily();
		const accessToken  = authService.generateAccessToken({ userId: user._id, role: user.role, email: user.email, name: user.name });
		const refreshToken = authService.generateRefreshToken({ userId: user._id, tokenFamily });

		const { ipAddress, userAgent } = getClientInfo(req);
		await authService.createRefreshToken(user._id, tokenFamily, refreshToken, ipAddress, userAgent);

		res.cookie('refreshToken', refreshToken, authService.getRefreshTokenCookieOptions());

		return res.json({
			accessToken,
			user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
			tokenExpiry: '15m'
		});

	} catch (error) {
		console.error(`[LOGIN-${requestId}] Error:`, error.message);
		return res.status(500).json({ error: "Login failed" });
	}
}

export async function refreshToken(req, res) {
	const requestId = Date.now();
	try {
		const token = req.cookies.refreshToken;
		if (!token) return res.status(401).json({ error: 'Refresh token not found', code: 'NO_REFRESH_TOKEN' });

		const decoded = authService.verifyRefreshToken(token);
		await authService.detectTokenReuse(decoded.tokenFamily);

		const { ipAddress, userAgent } = getClientInfo(req);
		const result = await authService.rotateTokens(token, ipAddress, userAgent);

		res.cookie('refreshToken', result.refreshToken, authService.getRefreshTokenCookieOptions());
		return res.json({ accessToken: result.accessToken, user: result.user, tokenExpiry: '15m' });

	} catch (error) {
		console.error(`[REFRESH-${requestId}] Error:`, error.message);
		if (error.message.includes('Token reuse detected')) {
			res.clearCookie('refreshToken', { path: '/api/auth' });
			return res.status(401).json({ error: error.message, code: 'TOKEN_REUSE_DETECTED' });
		}
		if (error.message.includes('expired') || error.message.includes('Invalid') || error.message.includes('no longer exists')) {
			res.clearCookie('refreshToken', { path: '/api/auth' });
			return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'REFRESH_TOKEN_INVALID' });
		}
		return res.status(500).json({ error: 'Token refresh failed' });
	}
}

export async function logout(req, res) {
	try {
		const token = req.cookies.refreshToken;
		if (token) await authService.logout(token);
		res.clearCookie('refreshToken', { path: '/api/auth' });
		return res.json({ message: 'Logged out successfully' });
	} catch (error) {
		console.error('[LOGOUT] Error:', error.message);
		return res.status(500).json({ error: 'Logout failed' });
	}
}

export async function logoutAllDevices(req, res) {
	try {
		await authService.logoutAllDevices(req.user.userId);
		res.clearCookie('refreshToken', { path: '/api/auth' });
		return res.json({ message: 'Logged out from all devices successfully' });
	} catch (error) {
		console.error('[LOGOUT-ALL] Error:', error.message);
		return res.status(500).json({ error: 'Logout from all devices failed' });
	}
}

export async function getMe(req, res) {
	try {
		const user = await UserModel.findById(req.user.userId).select('-passwordHash -failedLoginAttempts -lockUntil');
		if (!user) return res.status(404).json({ error: 'User not found' });
		res.json({ user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt } });
	} catch (error) {
		console.error('Get user error:', error);
		res.status(500).json({ error: 'Failed to fetch user data' });
	}
}

export async function getActiveSessions(req, res) {
	try {
		const sessions = await authService.getActiveSessions(req.user.userId);
		res.json({ sessions: sessions.map(s => ({ id: s._id, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, ipAddress: s.ipAddress, userAgent: s.userAgent, isCurrent: req.cookies.refreshToken === s.token })) });
	} catch (error) {
		console.error('Get sessions error:', error);
		res.status(500).json({ error: 'Failed to fetch active sessions' });
	}
}
