import mongoose, { Schema } from "mongoose";

const RefreshTokenSchema = new Schema(
	{
		userId: { 
			type: Schema.Types.ObjectId, 
			ref: "User", 
			required: true,
			index: true 
		},
		token: { 
			type: String, 
			required: true, 
			unique: true,
			index: true 
		},
		tokenFamily: { 
			type: String, 
			required: true,
			index: true 
		}, // For token rotation detection
		expiresAt: { 
			type: Date, 
			required: true,
			index: { expireAfterSeconds: 0 } // MongoDB TTL index
		},
		createdAt: { 
			type: Date, 
			default: Date.now 
		},
		lastUsedAt: { 
			type: Date, 
			default: Date.now 
		},
		ipAddress: { 
			type: String, 
			required: true 
		},
		userAgent: { 
			type: String, 
			required: true 
		},
		isRevoked: { 
			type: Boolean, 
			default: false 
		},
		revokedAt: { 
			type: Date 
		},
		revokedReason: { 
			type: String,
			enum: ['logout', 'token_reuse', 'token_rotation', 'security_breach', 'password_change', 'admin_revoke']
		}
	},
	{ 
		timestamps: true,
		// Compound indexes for efficient queries
		indexes: [
			{ userId: 1, tokenFamily: 1 },
			{ userId: 1, isRevoked: 1 },
			{ tokenFamily: 1, isRevoked: 1 }
		]
	}
);

// Clean up expired tokens periodically
RefreshTokenSchema.statics.cleanupExpired = function() {
	return this.deleteMany({
		$or: [
			{ expiresAt: { $lt: new Date() } },
			{ isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Keep revoked tokens for 24h for audit
		]
	});
};

// Revoke all tokens for a user (password change, security breach)
RefreshTokenSchema.statics.revokeAllForUser = function(userId, reason = 'security_breach') {
	return this.updateMany(
		{ userId, isRevoked: false },
		{ 
			isRevoked: true, 
			revokedAt: new Date(),
			revokedReason: reason
		}
	);
};

// Revoke entire token family (token reuse detection)
RefreshTokenSchema.statics.revokeTokenFamily = function(tokenFamily, reason = 'token_reuse') {
	return this.updateMany(
		{ tokenFamily, isRevoked: false },
		{ 
			isRevoked: true, 
			revokedAt: new Date(),
			revokedReason: reason
		}
	);
};

export const RefreshTokenModel = mongoose.model("RefreshToken", RefreshTokenSchema);