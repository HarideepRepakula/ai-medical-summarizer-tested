import mongoose, { Schema } from "mongoose";

const TranscriptSchema = new Schema(
	{
		appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
		patientId:     { type: Schema.Types.ObjectId, ref: "User",        required: true },
		doctorId:      { type: Schema.Types.ObjectId, ref: "User",        required: true },
		// Raw transcription from Web Speech API / Whisper
		rawText:       { type: String, default: "" },
		// AI-generated consultation summary (Gemini)
		summaryAi:     { type: String, default: "" },
		// Individual utterances for RAG context chunking
		segments: [
			{
				speaker:   { type: String, enum: ["doctor", "patient", "unknown"], default: "unknown" },
				text:      { type: String },
				timestamp: { type: Date, default: Date.now }
			}
		],
		// Duration in seconds
		durationSeconds: { type: Number },
		// Flag for RAG chatbot — was this session used to escalate?
		escalated:       { type: Boolean, default: false }
	},
	{ timestamps: true }
);

TranscriptSchema.index({ patientId: 1, createdAt: -1 });
// appointmentId index is already created by unique:true in the field definition — no duplicate needed

export const TranscriptModel = mongoose.model("Transcript", TranscriptSchema);
