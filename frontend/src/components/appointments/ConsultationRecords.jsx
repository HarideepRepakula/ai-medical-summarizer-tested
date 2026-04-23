import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import ConsultationChatbot from './ConsultationChatbot.jsx';
import apiService from '../../services/api.js';

const MEDICAL_TERMS = [
	'Diabetes', 'Hypertension', 'Ultrasound', 'Glucose', 'Positive', 'Negative',
	'Acute', 'Chronic', 'Fever', 'Infection', 'Inflammation', 'Anemia', 'Thyroid',
	'Cholesterol', 'Hemoglobin', 'Platelet', 'Biopsy', 'Fracture', 'Tumor',
	'Malignant', 'Benign', 'Cardiac', 'Pulmonary', 'Renal', 'Hepatic', 'Insulin',
	'Antibiotics', 'Steroids', 'Dosage', 'Prescription', 'Diagnosis', 'Prognosis',
	'Symptoms', 'Treatment', 'Surgery', 'Radiology', 'Pathology', 'Oncology',
	'Neurology', 'Orthopedic', 'Pediatric', 'Geriatric', 'Allergy', 'Asthma',
	'Normal', 'Abnormal', 'Critical', 'Stable'
];

function HighlightText({ text }) {
	if (!text) return null;
	const regex = new RegExp(`\\b(${MEDICAL_TERMS.join('|')})\\b`, 'gi');
	const parts = text.split(regex);
	return (
		<p className="text-sm leading-relaxed">
			{parts.map((part, i) =>
				MEDICAL_TERMS.some(t => t.toLowerCase() === part.toLowerCase()) ? (
					<span key={i} className="bg-sky-100 text-sky-700 px-1 rounded font-bold">{part}</span>
				) : part
			)}
		</p>
	);
}

export default function ConsultationRecords({ appointment, onBack }) {
	const [records, setRecords] = useState(null);
	const [loading, setLoading] = useState(true);
	const [activeSection, setActiveSection] = useState('summary');
	const [transcriptExpanded, setTranscriptExpanded] = useState(false);
	const [bartSummary, setBartSummary] = useState('');
	const [bartLoading, setBartLoading] = useState(false);

	const doctorName = typeof appointment.doctor === 'object' ? appointment.doctor.name : appointment.doctor;

	useEffect(() => {
		loadRecords();
	}, [appointment?.id]);

	async function loadRecords() {
		setLoading(true);
		try {
			const res = await apiService.getConsultationRecords(appointment.id);
			if (res.success) {
				setRecords(res.data);
			}
		} catch (err) {
			setRecords({
				meetingSummary: appointment.consultationRecords?.meetingSummary || 'Summary will be available once the AI processes the consultation.',
				meetingTranscript: appointment.consultationRecords?.meetingTranscript || '',
				medicines: appointment.consultationRecords?.medicines || [],
				prescriptionImageUrl: appointment.consultationRecords?.prescriptionImageUrl || null,
				linkedRecords: appointment.linkedRecords || []
			});
		} finally {
			setLoading(false);
		}
	}

	async function handleBartSummary() {
		setBartLoading(true);
		try {
			const res = await apiService.request('/ai/bart-summary', {
				method: 'POST',
				body: JSON.stringify({ text: records.meetingSummary })
			});
			if (res.success) setBartSummary(res.summary);
		} catch (e) {
			console.error('BART error:', e);
		} finally {
			setBartLoading(false);
		}
	}

	function handleDownloadPDF() {
		const doc = new jsPDF();

		// Header bar
		doc.setFillColor(40, 116, 240);
		doc.rect(0, 0, 210, 28, 'F');
		doc.setFontSize(18);
		doc.setTextColor(255, 255, 255);
		doc.text('ClinIQ AI Medical Summary', 14, 18);

		// Patient / Doctor info
		doc.setFontSize(10);
		doc.setTextColor(80, 80, 80);
		doc.text(`Doctor: ${doctorName}`, 14, 38);
		doc.text(`Date: ${appointment.date} at ${appointment.startTime}`, 14, 45);
		doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 52);

		// Divider
		doc.setDrawColor(40, 116, 240);
		doc.setLineWidth(0.5);
		doc.line(14, 57, 196, 57);

		// Section title
		doc.setFontSize(12);
		doc.setTextColor(40, 116, 240);
		doc.text('Clinical Findings (Llama 3.2 Abstractive Summary):', 14, 65);

		// Summary body
		doc.setFontSize(10);
		doc.setTextColor(30, 30, 30);
		const lines = doc.splitTextToSize(bartSummary, 178);
		doc.text(lines, 14, 74);

		// Disclaimer footer
		doc.setFontSize(8);
		doc.setTextColor(150, 150, 150);
		doc.text('Note: This is an AI-generated summary (Ollama Llama 3.2). Please consult your physician.', 14, 284);

		doc.save(`ClinIQ_Summary_${Date.now()}.pdf`);
	}

	const sections = [
		{ id: 'summary',       label: 'Summary',        icon: '🧠' },
		{ id: 'prescription',  label: 'Prescription',   icon: '💊' },
		{ id: 'transcript',    label: 'Transcript',     icon: '📝' },
		{ id: 'records',       label: 'Linked Records', icon: '📎' },
		{ id: 'chatbot',       label: 'AI Assistant',   icon: '🤖' },
	];

	if (loading) {
		return (
			<div className="space-y-6 animate-fade-in">
				<div className="flex items-center gap-4">
					<button onClick={onBack} className="btn-ghost btn-sm text-xs">← Back</button>
					<h1 className="text-2xl font-bold text-text-primary">Loading Records...</h1>
				</div>
				<div className="card flex items-center justify-center py-20">
					<div className="flex flex-col items-center gap-3">
						<div className="w-10 h-10 border-3 border-gray-200 border-t-ai-500 rounded-full animate-spin" />
						<span className="text-sm text-text-secondary">Loading consultation records...</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 animate-fade-in">
			{/* Header */}
			<div className="flex items-center gap-4">
				<button onClick={onBack} className="btn-ghost btn-sm text-xs">← Back</button>
				<div className="flex-1">
					<h1 className="text-2xl font-bold text-text-primary">Consultation Records</h1>
					<p className="text-text-secondary text-sm mt-0.5">
						{doctorName} • {appointment.date} at {appointment.startTime}
					</p>
				</div>
				<span className="badge-success text-xs">✅ Completed</span>
			</div>

			{/* Section Tabs */}
			<div className="flex gap-2 flex-wrap">
				{sections.map(section => (
					<button
						key={section.id}
						onClick={() => setActiveSection(section.id)}
						className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-clinical text-sm font-medium transition-all ${
							activeSection === section.id
								? 'bg-primary-600 text-white shadow-clinical-md'
								: 'bg-white border border-gray-200 text-text-secondary hover:border-primary-200 hover:text-primary-700'
						}`}
					>
						<span>{section.icon}</span>
						{section.label}
					</button>
				))}
			</div>

			{/* ── Meeting Summary ─────────────────────────────────────────────── */}
			{activeSection === 'summary' && (
				<div className="card-ai animate-fade-in">
					<div className="flex items-center gap-2 mb-4">
						<span className="text-xl">🧠</span>
						<h3 className="font-semibold text-text-primary">AI Meeting Summary</h3>
						<span className="badge-ai text-[10px]">Llama 3.2 AI</span>
					</div>

					{records?.meetingSummary ? (
						<div className="prose prose-sm max-w-none">
							<HighlightText text={records.meetingSummary} />
						</div>
					) : (
						<div className="text-center py-8 text-text-secondary text-sm">
							<span className="text-3xl block mb-2 opacity-60">📝</span>
							Summary will be available once AI finishes processing.
						</div>
					)}

					{/* BART Summary Section */}
					{records?.meetingSummary && (
						<div className="mt-4 border-t border-gray-100 pt-4">
							<div className="flex items-center gap-2 mb-2">
								<span className="text-base">🤖</span>
								<span className="text-sm font-semibold text-text-primary">Llama 3.2 Abstractive Summary</span>
								<span className="badge-ai text-[10px]">ollama/llama3.2</span>
							</div>
							{bartSummary ? (
								<>
									<HighlightText text={bartSummary} />
									<button
										onClick={handleDownloadPDF}
										className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-clinical hover:bg-primary-700 transition-colors"
									>
										📥 Download PDF
									</button>
								</>
							) : (
								<button
									onClick={handleBartSummary}
									disabled={bartLoading}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white text-xs rounded-clinical hover:bg-sky-700 transition-colors disabled:opacity-60"
								>
									{bartLoading ? '⏳ Generating...' : '✨ Generate Llama 3.2 Summary'}
								</button>
							)}
						</div>
					)}

					<p className="text-[10px] text-text-secondary mt-4">
						⚕️ AI-generated from the consultation audio. Not a substitute for the doctor's notes.
					</p>
				</div>
			)}

			{/* ── Prescription ────────────────────────────────────────────────── */}
			{activeSection === 'prescription' && (
				<div className="space-y-5 animate-fade-in">
					{records?.prescriptionImageUrl && (
						<div className="card">
							<h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
								<span>📄</span> Prescription Document
							</h3>
							<div className="bg-gray-50 rounded-clinical p-4 flex items-center justify-center min-h-[200px]">
								{records.prescriptionImageUrl.endsWith('.pdf') ? (
									<a href={records.prescriptionImageUrl} target="_blank" rel="noopener noreferrer"
										className="btn-primary btn-sm text-xs">
										📥 View / Download PDF
									</a>
								) : (
									<img
										src={records.prescriptionImageUrl}
										alt="Prescription"
										className="max-w-full max-h-[400px] rounded-clinical shadow-clinical"
									/>
								)}
							</div>
						</div>
					)}

					<div className="card overflow-hidden p-0">
						<div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
							<span className="text-lg">💊</span>
							<h3 className="font-semibold text-text-primary">Prescribed Medicines</h3>
						</div>

						{records?.medicines?.length > 0 ? (
							<table className="table-clinical">
								<thead>
									<tr>
										<th>#</th>
										<th>Medicine</th>
										<th>Dosage</th>
										<th>Frequency</th>
										<th>Duration</th>
									</tr>
								</thead>
								<tbody>
									{records.medicines.map((med, i) => (
										<tr key={i}>
											<td className="text-text-secondary">{i + 1}</td>
											<td className="font-medium">{med.name}</td>
											<td>{med.dosage}</td>
											<td>{med.frequency}</td>
											<td>{med.duration || '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						) : (
							<div className="text-center py-8 text-text-secondary text-sm">
								<span className="text-3xl block mb-2 opacity-60">💊</span>
								No medicines prescribed in this consultation.
							</div>
						)}
					</div>
				</div>
			)}

			{/* ── Full Transcript ──────────────────────────────────────────────── */}
			{activeSection === 'transcript' && (
				<div className="card animate-fade-in">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<span className="text-lg">📝</span>
							<h3 className="font-semibold text-text-primary">Meeting Transcript</h3>
							<span className="badge-ai text-[10px]">AI-Generated</span>
						</div>
						{records?.meetingTranscript && (
							<button
								onClick={() => setTranscriptExpanded(!transcriptExpanded)}
								className="btn-ghost btn-sm text-xs"
							>
								{transcriptExpanded ? '🔽 Collapse' : '🔼 Expand Full'}
							</button>
						)}
					</div>

					{records?.meetingTranscript ? (
						<div className={`bg-gray-50 rounded-clinical p-4 overflow-hidden transition-all ${
							transcriptExpanded ? 'max-h-none' : 'max-h-[300px]'
						}`}>
							<pre className="text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
								{records.meetingTranscript}
							</pre>
							{!transcriptExpanded && (
								<div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />
							)}
						</div>
					) : (
						<div className="text-center py-8 text-text-secondary text-sm">
							<span className="text-3xl block mb-2 opacity-60">🎤</span>
							Transcript will be available once the AI processes the consultation audio.
						</div>
					)}
				</div>
			)}

			{/* ── Linked Records ───────────────────────────────────────────────── */}
			{activeSection === 'records' && (
				<div className="card animate-fade-in">
					<div className="flex items-center gap-2 mb-4">
						<span className="text-lg">📎</span>
						<h3 className="font-semibold text-text-primary">Linked Medical Records</h3>
					</div>

					{records?.linkedRecords?.length > 0 ? (
						<div className="space-y-2">
							{records.linkedRecords.map((file, i) => (
								<div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-clinical hover:bg-gray-100 transition-colors">
									<span className="text-xl">
										{file.fileType?.includes('pdf') ? '📕' :
										 file.fileType?.includes('image') || file.fileType?.includes('jpg') || file.fileType?.includes('png') ? '🖼️' : '📄'}
									</span>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-text-primary truncate">{file.fileName}</p>
										<p className="text-[11px] text-text-secondary">
											Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
										</p>
									</div>
									{file.fileUrl && (
										<a
											href={file.fileUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="btn-ghost btn-sm text-xs"
										>
											📥 View
										</a>
									)}
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-8 text-text-secondary text-sm">
							<span className="text-3xl block mb-2 opacity-60">📎</span>
							No medical records were uploaded for this consultation.
						</div>
					)}
				</div>
			)}

			{/* ── AI Chatbot ───────────────────────────────────────────────────── */}
			{activeSection === 'chatbot' && (
				<div className="animate-fade-in">
					<ConsultationChatbot
						appointmentId={appointment.id}
						contextLabel={`Consultation with ${doctorName} on ${appointment.date}`}
					/>
				</div>
			)}
		</div>
	);
}
