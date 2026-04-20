import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new Schema(
	{
		name: { type: String, required: true },
		phone: { 
			type: String, 
			required: true, 
			unique: true,
			validate: {
				validator: function(v) {
					return /^[\+]?[\d\s\-\(\)]+$/.test(v);
				},
				message: 'Invalid phone number format'
			}
		},
		email: { type: String, required: false, unique: true, sparse: true },
		passwordHash: { type: String, required: true },
		role: { type: String, enum: ["DOCTOR", "PATIENT", "ADMIN", "PHARMACY"], required: true },
		// Security enhancements
		passwordChangedAt: { type: Date, default: Date.now },
		lastLoginAt: { type: Date },
		lastLoginIP: { type: String },
		failedLoginAttempts: { type: Number, default: 0 },
		lockUntil: { type: Date },
		isActive: { type: Boolean, default: true },
		twoFactorEnabled: { type: Boolean, default: false },
		twoFactorSecret: { type: String }
	},
	{ timestamps: true }
);

// Password strength validation
UserSchema.pre('save', function(next) {
	if (this.isModified('passwordHash') && !this.isNew) {
		this.passwordChangedAt = new Date();
	}
	next();
});

// Account lockout logic
UserSchema.virtual('isLocked').get(function() {
	return !!(this.lockUntil && this.lockUntil > Date.now());
});

UserSchema.methods.incLoginAttempts = function() {
	// If we have a previous lock that has expired, restart at 1
	if (this.lockUntil && this.lockUntil < Date.now()) {
		return this.updateOne({
			$unset: { lockUntil: 1 },
			$set: { failedLoginAttempts: 1 }
		});
	}
	
	const updates = { $inc: { failedLoginAttempts: 1 } };
	
	// If we have max attempts and no lock, lock the account
	if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked) {
		updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
	}
	
	return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function() {
	return this.updateOne({
		$unset: { failedLoginAttempts: 1, lockUntil: 1 }
	});
};

export const UserModel = mongoose.model("User", UserSchema);





