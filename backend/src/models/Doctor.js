import mongoose, { Schema } from "mongoose";

const DoctorSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
		specialty: { type: String, required: true },
		experience: { type: String, required: true },
		rating: { type: Number, default: 4.5, min: 0, max: 5 },
		consultationFee: { type: Number, required: true },
		availability: [{
			day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
			startTime: String,
			endTime: String
		}],
		image: { type: String, default: '' }
	},
	{ timestamps: true }
);

export const DoctorModel = mongoose.model("Doctor", DoctorSchema);