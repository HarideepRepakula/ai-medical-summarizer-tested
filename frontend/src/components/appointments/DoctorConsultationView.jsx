import { useState, useEffect, useRef } from 'react';
import useConsultationTimer from '../../hooks/useConsultationTimer.js';
import apiService from '../../services/api.js';

// ── Rich AI Summary (read-only for doctor) ───────────────────────────────────
function RichAiSummary({ data, loading, error }) {
	if (loading) return (
		<div className="space-y-3 animate-pulse">
			{[100, 75, 90, 60].map((w, i) => (
				<div key={i} className="h-3 bg-ai-100 rounded" style={{ width: `${w}%` }} />
			))}
			<p className="text-xs text-ai-500 flex items-center gap-1.5 mt-3">
				<span className="w-3 h-3 border-2 border-ai-300 border-t-ai-600 rounded-full animate-spin inline-block" />
				Generating AI summary...
			</p>
		</div>
	);

	if (error && !data) return (
		<div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 rounded-clinical border border-amber-200">
			<span>⚠️</span> {error}
		</div>
	);

	if (!data) return null;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<span className="text-xs text-success-600 flex items-center gap-1">
					<span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" /> Summary Ready
				</span>
				{data.riskLevel && (
					<span className={`badge text-[10px] ${
						data.riskLevel === 'high' ? 'badge-danger' :
						data.riskLevel === 'moderate' ? 'badge-amber' : 'badge-success'
					}`}>Risk: {data.riskLevel?.toUpperCase()}</span>
				)}
			</div>

			{data.patientOverview && (
				<div>
					<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">👤 Patient Overview</p>
					<p className="text-sm text-text-secondary leading-relaxed p-3 bg-white/60 rounded-clinical border border-ai-100">{data.patientOverview}</p>
				</div>
			)}

			{data.labFindings?.length > 0 && (
				<div>
					<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">🧪 Lab Findings</p>
					<div className="space-y-1.5">
						{data.labFindings.map((f, i) => (
							<div key={i} className="flex items-start gap-2 text-xs p-2 bg-white/60 rounded border border-gray-100">
								<span className="shrink-0">{f.flag === 'high' ? '⬆️' : f.flag === 'low' ? '⬇️' : '✅'}</span>
								<div>
									<span className="font-medium">{typeof f === 'string' ? f : f.test}</span>
									{f.value && <span className="text-text-secondary ml-1">{f.value}</span>}
									{f.note && <p className="text-text-secondary mt-0.5">{f.note}</p>}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{data.prescriptions?.length > 0 && (
				<div>
					<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">💊 Current Medications</p>
					<div className="flex flex-wrap gap-1.5">
						{data.prescriptions.map((p, i) => (
							<span key={i} className="px-2 py-1 bg-primary-50 border border-primary-100 rounded-full text-xs text-primary-700">
								{typeof p === 'string' ? p : `${p.name} ${p.dosage}`}
							</span>
						))}
					</div>
				</div>
			)}

			{data.concerns?.length > 0 && (
				<div>
					<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">⚠️ Current Concerns</p>
					<ul className="space-y-1">
						{data.concerns.map((c, i) => (
							<li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
								<span className="text-amber-500 shrink-0 mt-0.5">●</span>{c}
							</li>
						))}
					</ul>
				</div>
			)}

			{data.editablePoints?.length > 0 && (
				<div className="pt-3 border-t border-ai-100">
					<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">🎯 Patient's Discussion Points</p>
					<ul className="space-y-1">
						{data.editablePoints.map((pt, i) => (
							<li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
								<span className="text-ai-400 shrink-0 mt-0.5">●</span>{pt}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

// ── Patient Queries Tab ───────────────────────────────────────────────────────
function PatientQueriesTab({ appointmentId }) {
	const [queries, setQueries] = useState([]);
	const [loading, setLoading] = useState(true);
	const [replyText, setReplyText] = useState({});
	const [submitting, setSubmitting] = useState({});

	useEffect(() => { loadQueries(); }, [appointmentId]);

	async function loadQueries() {
		setLoading(true);
		try {
			const res = await apiService.getPatientQueries(appointmentId);
			if (res.success) setQueries(res.data || []);
		} catch {
			setQueries([]);
		} finally {
			setLoading(false);
		}
	}

	async function submitReply(queryId) {
		const text = replyText[queryId]?.trim();
		if (!text) return;
		setSubmitting(prev => ({ ...prev, [queryId]: true }));
		try {
			await apiService.respondToPatientQuery(appointmentId, queryId, text);
			setReplyText(prev => ({ ...prev, [queryId]: '' }));
			await loadQueries();
		} catch {
			// silent
		} finally {
			setSubmitting(prev => ({ ...prev, [queryId]: false }));
		}
	}

	if (loading) return (
		<div className="flex items-center justify-center py-12">
			<div className="w-8 h-8 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
		</div>
	);

	if (queries.length === 0) return (
		<div className="text-center py-12">
			<span className="text-4xl block mb-3 opacity-60">💬</span>
			<p className="text-text-secondary text-sm">No patient queries yet.</p>
			<p className="text-text-secondary text-xs mt-1">Escalated questions from the patient's AI chatbot will appear here.</p>
		</div>
	);

	return (
		<div className="space-y-4">
			{queries.map(q => (
				<div key={q._id} className="card border border-amber-100 bg-amber-50/30">
					<div className="flex items-start justify-between gap-3 mb-3">
						<div className="flex items-center gap-2">
							<span className="text-lg">🚨</span>
							<div>
								<p className="text-sm font-medium text-text-primary">{q.question}</p>
								<p className="text-[11px] text-text-secondary mt-0.5">
									Escalated {new Date(q.escalatedAt).toLocaleString()}
								</p>
							</div>
						</div>
						{q.doctorResponse ? (
							<span className="badge-success text-[10px] shrink-0">✅ Answered</span>
						) : (
							<span className="badge-amber text-[10px] shrink-0">⏳ Pending</span>
						)}
					</div>

					{q.doctorResponse ? (
						<div className="bg-success-50 border border-success-100 rounded-clinical p-3 text-sm text-success-700">
							<p className="text-[10px] font-semibold uppercase tracking-wider mb-1">Your Response</p>
							{q.doctorResponse}
						</div>
					) : (
						<div className="flex gap-2 mt-2">
							<textarea
								className="input resize-none text-sm flex-1"
								rows={2}
								placeholder="Type your response to the patient..."
								value={replyText[q._id] || ''}
								onChange={e => setReplyText(prev => ({ ...prev, [q._id]: e.target.value }))}
							/>
							<button
								onClick={() => submitReply(q._id)}
								disabled={submitting[q._id] || !replyText[q._id]?.trim()}
								className="btn-primary btn-sm text-xs self-end"
							>
								{submitting[q._id] ? '...' : 'Reply'}
							</button>
						</div>
					)}
				</div>
			))}
		</div>
	);
}

// ── Main Doctor Consultation View ─────────────────────────────────────────────
export default function DoctorConsultationView({ appointment, onBack }) {
	const [activeTab, setActiveTab]         = useState('reports');
	const [aiSummary, setAiSummary]         = useState(null);
	const [loadingSummary, setLoadingSummary] = useState(true);
	const [summaryError, setSummaryError]   = useState('');
	const [uploadedFiles, setUploadedFiles] = useState(appointment?.linkedRecords || []);
	const [meetingActive, setMeetingActive] = useState(false);
	const [isRecording, setIsRecording]     = useState(false);
	// AI Scribe state
	const [scribeText, setScribeText]       = useState('');
	const [scribeSaved, setScribeSaved]     = useState(false);
	const mediaRecorderRef = useRef(null);
	const audioChunksRef   = useRef([]);
	const scribeRef        = useRef(null);
	const scribeTimerRef   = useRef(null);
	const scribeSegments   = useRef([]);
	const [scribeDuration, setScribeDuration] = useState(0);
	const [scribeListening, setScribeListening] = useState(false);
	const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

	const timer = useConsultationTimer(
		appointment?.date,
		appointment?.startTime,
		appointment?.status
	);

	// Re-render every 30s for time-based access control
	const [, forceUpdate] = useState(0);
	useEffect(() => {
		const interval = setInterval(() => forceUpdate(n => n + 1), 30000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => { loadAiSummary(); }, [appointment?.id]);

	async function loadAiSummary() {
		setLoadingSummary(true);
		setSummaryError('');
		try {
			const res = await apiService.getAiSummary(appointment.id);
			if (res.success) setAiSummary(res.data);
		} catch {
			setSummaryError('AI summary not yet available. It will appear 10 minutes before the consultation.');
		} finally {
			setLoadingSummary(false);
		}
	}

	// Doctor gets access to summary only at T-10
	const summaryAccessible = timer.summaryLocked || timer.isStarted || timer.isCompleted;
	// Reports & meeting accessible at T-15
	const reportsAccessible = timer.meetingEnabled || timer.isStarted || timer.isCompleted;

	const patientName = typeof appointment.patient === 'object'
		? appointment.patient.name
		: appointment.patient;

	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
			audioChunksRef.current = [];
			mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
			mediaRecorderRef.current = mediaRecorder;
			mediaRecorder.start(1000);
			setIsRecording(true);
			// Also start speech recognition for live transcription
			if (SpeechRecognition) {
				const rec = new SpeechRecognition();
				rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
				rec.onresult = (e) => {
					let final = '';
					for (let x = e.resultIndex; x < e.results.length; x++) {
						if (e.results[x].isFinal) {
							final += e.results[x][0].transcript + ' ';
							scribeSegments.current.push({ speaker: 'doctor', text: e.results[x][0].transcript.trim(), timestamp: new Date().toISOString() });
						}
					}
					if (final) setScribeText(p => p + final);
				};
				rec.start();
				scribeRef.current = rec;
				scribeTimerRef.current = setInterval(() => setScribeDuration(d => d + 1), 1000);
				setScribeListening(true);
			}
		} catch (err) { console.error('Recording failed:', err); }
	}

	function stopRecording() {
		if (mediaRecorderRef.current?.state !== 'inactive') {
			mediaRecorderRef.current.stop();
			mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
			setIsRecording(false);
		}
		if (scribeRef.current) {
			scribeRef.current.stop();
			scribeRef.current = null;
			clearInterval(scribeTimerRef.current);
			setScribeListening(false);
		}
	}

	async function endMeeting() {
		stopRecording();
		setMeetingActive(false);
		try {
			// Save transcript first if we have scribe text
			if (scribeText.trim()) {
				await apiService.saveTranscript({
					appointmentId: appointment.id,
					rawText: scribeText,
					segments: scribeSegments.current,
					durationSeconds: scribeDuration
				});
				setScribeSaved(true);
			}
			// Complete consultation with actual transcript
			await apiService.completeConsultation(appointment.id, {
				rawText: scribeText || '[Meeting completed — no transcript captured]',
				durationSeconds: scribeDuration,
				hasAudio: audioChunksRef.current.length > 0
			});
		} catch (err) { console.error('End meeting error:', err); }
	}

	const tabs = [
		{ id: 'reports', label: 'Reports', icon: '📋' },
		{ id: 'meeting', label: 'Meeting', icon: '🎥' },
		{ id: 'queries', label: 'Patient Queries', icon: '💬' },
	];

	return (
		<div className="space-y-6 animate-fade-in">
			{/* Header */}
			<div className="flex items-center gap-4">
				<button onClick={onBack} className="btn-ghost btn-sm text-xs">← Back</button>
				<div className="flex-1">
					<h1 className="text-2xl font-bold text-text-primary">Consultation View</h1>
					<p className="text-text-secondary text-sm mt-0.5">
						{patientName} • {appointment.date} at {appointment.startTime}
					</p>
				</div>
				<span className="badge-ai">
					<span className="w-1.5 h-1.5 rounded-full bg-ai-500 animate-pulse-soft" />
					AI Powered
				</span>
			</div>

			{/* Phase Banner */}
			<div className={`flex items-center gap-3 p-4 rounded-clinical border animate-fade-in ${
				timer.isCompleted ? 'bg-gray-50 border-gray-200' :
				timer.isStarted ? 'bg-success-50 border-success-200' :
				summaryAccessible ? 'bg-ai-50 border-ai-200' :
				reportsAccessible ? 'bg-amber-50 border-amber-200' :
				'bg-primary-50 border-primary-200'
			}`}>
				<span className="text-2xl shrink-0">
					{timer.isCompleted ? '✅' : timer.isStarted ? '🟢' : summaryAccessible ? '🔓' : reportsAccessible ? '📋' : '⏳'}
				</span>
				<div className="flex-1">
					<p className="text-sm font-semibold text-text-primary">
						{timer.isCompleted ? 'Consultation Completed' :
						 timer.isStarted ? 'Consultation In Progress' :
						 summaryAccessible ? 'AI Summary Ready — Reports Accessible' :
						 reportsAccessible ? 'Reports Accessible — Summary Available in ' + Math.max(0, Math.ceil(timer.minutesUntilStart - 10)) + 'm' :
						 'Waiting — Access Opens 15 Minutes Before Consultation'}
					</p>
					<p className="text-xs text-text-secondary mt-0.5">
						{timer.isCompleted ? 'View post-consultation records below.' :
						 reportsAccessible ? 'Meeting room and reports are now accessible.' :
						 `Reports and meeting room activate ${Math.max(0, Math.ceil(timer.minutesUntilStart - 15))} minutes before start.`}
					</p>
				</div>
				<div className="text-right shrink-0">
					<div className={`text-lg font-bold font-mono ${timer.minutesUntilStart <= 5 && !timer.isStarted ? 'text-danger-500 animate-pulse-soft' : 'text-primary-600'}`}>
						{timer.formattedCountdown}
					</div>
					<p className="text-[10px] text-text-secondary uppercase tracking-wider">
						{timer.isStarted ? 'Elapsed' : 'Countdown'}
					</p>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex gap-2 flex-wrap">
				{tabs.map(tab => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-clinical text-sm font-medium transition-all ${
							activeTab === tab.id
								? 'bg-primary-600 text-white shadow-clinical-md'
								: 'bg-white border border-gray-200 text-text-secondary hover:border-primary-200 hover:text-primary-700'
						}`}
					>
						<span>{tab.icon}</span>{tab.label}
					</button>
				))}
			</div>

			{/* ── REPORTS TAB ── */}
			{activeTab === 'reports' && (
				<div className="space-y-5 animate-fade-in">
					{!reportsAccessible ? (
						<div className="card text-center py-16">
							<span className="text-5xl block mb-4 opacity-40">🔒</span>
							<h3 className="font-semibold text-text-primary mb-2">Reports Not Yet Available</h3>
							<p className="text-sm text-text-secondary">
								Patient reports and AI summary will be accessible 15 minutes before the consultation.
							</p>
							<p className="text-sm font-semibold text-primary-600 mt-3">
								Opens in {Math.max(0, Math.ceil(timer.minutesUntilStart - 15))} minutes
							</p>
						</div>
					) : (
						<div className="grid lg:grid-cols-2 gap-6">
							{/* AI Summary */}
							<div className="card-ai">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2">
										<span className="text-lg">🧠</span>
										<h3 className="font-semibold text-text-primary">AI Pre-Consultation Briefing</h3>
									</div>
									{!summaryAccessible && (
										<span className="badge-amber text-[10px]">🔒 Available in {Math.max(0, Math.ceil(timer.minutesUntilStart - 10))}m</span>
									)}
									{summaryAccessible && (
										<span className="badge-success text-[10px]">🔓 Unlocked</span>
									)}
								</div>

								{!summaryAccessible ? (
									<div className="text-center py-8">
										<span className="text-3xl block mb-2 opacity-40">🔒</span>
										<p className="text-sm text-text-secondary">
											Patient's AI briefing will be shared with you 10 minutes before the consultation.
										</p>
										<p className="text-xs text-primary-600 mt-2 font-medium">
											Unlocks in {Math.max(0, Math.ceil(timer.minutesUntilStart - 10))} minutes
										</p>
									</div>
								) : (
									<RichAiSummary
										data={aiSummary}
										loading={loadingSummary}
										error={summaryError}
									/>
								)}

								<p className="text-[10px] text-text-secondary mt-4">
									⚕️ AI-generated from patient's history. Use clinical judgment.
								</p>
							</div>

							{/* Uploaded Medical Records */}
							<div className="card">
								<div className="flex items-center gap-2 mb-4">
									<span className="text-lg">📎</span>
									<h3 className="font-semibold text-text-primary">Patient's Medical Records</h3>
								</div>

								{uploadedFiles.length > 0 ? (
									<div className="space-y-2">
										{uploadedFiles.map((file, i) => (
											<div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-clinical text-sm">
												<span className="text-base">{file.fileType?.includes('pdf') ? '📕' : '🖼️'}</span>
												<div className="flex-1 min-w-0">
													<p className="text-text-primary truncate text-xs font-medium">{file.fileName}</p>
													<p className="text-[10px] text-text-secondary">{new Date(file.uploadedAt).toLocaleString()}</p>
												</div>
												{file.fileUrl && file.fileUrl !== '#' && (
													<a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm text-xs">
														📥 View
													</a>
												)}
											</div>
										))}
									</div>
								) : (
									<div className="text-center py-8">
										<span className="text-3xl block mb-2 opacity-60">📎</span>
										<p className="text-sm text-text-secondary">No records uploaded by patient yet.</p>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			)}

			{/* ── MEETING TAB ── */}
			{activeTab === 'meeting' && (
				<div className="animate-fade-in">
					<div className={`card flex flex-col ${!reportsAccessible && !meetingActive ? 'opacity-60' : ''}`}>
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<span className="text-lg">🎥</span>
								<h3 className="font-semibold text-text-primary">Video Consultation Room</h3>
							</div>
							{isRecording && (
								<span className="badge-danger text-[10px] animate-pulse-soft">
									<span className="w-2 h-2 rounded-full bg-danger-500" /> Recording
								</span>
							)}
						</div>

						{!meetingActive ? (
							<div className="flex flex-col items-center justify-center text-center p-6">
								{!reportsAccessible ? (
									<>
										<div className="relative w-full aspect-video bg-gray-100 rounded-clinical mb-5 flex items-center justify-center">
											<div className="text-center">
												<span className="text-5xl block mb-3 opacity-40 grayscale">🎥</span>
												<p className="text-sm font-semibold text-text-secondary">Meeting Room Locked</p>
												<p className="text-xs text-text-secondary mt-1">Activates 15 minutes before consultation</p>
											</div>
										</div>
										<div className="bg-gray-50 rounded-clinical p-4 w-full">
											<p className="text-sm font-semibold text-text-primary">
												⏱ Activates in {Math.max(0, Math.ceil(timer.minutesUntilStart - 15))} minutes
											</p>
										</div>
									</>
								) : (
									<>
										<div className="relative w-full aspect-video bg-gradient-to-br from-primary-50 to-ai-50 rounded-clinical mb-5 flex items-center justify-center border border-primary-200">
											<div className="text-center">
												<span className="text-5xl block mb-3">🩺</span>
												<p className="text-sm font-semibold text-primary-700">🟢 Ready to Start</p>
												<p className="text-xs text-text-secondary mt-1">Patient: {patientName}</p>
											</div>
										</div>
										<button onClick={() => setMeetingActive(true)} className="btn-primary btn-lg w-full">
											🎥 Start Consultation
										</button>
									</>
								)}
							</div>
						) : (
							<div className="flex flex-col">
								<div className="bg-gray-900 rounded-clinical overflow-hidden relative mb-4" style={{ minHeight: 360 }}>
									<iframe
										src={`https://meet.jit.si/ClinIQ-${appointment.id}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false`}
										style={{ width: '100%', height: '100%', border: 'none', minHeight: 360 }}
										allow="camera;microphone;display-capture"
										title="ClinIQ Video Consultation"
									/>
								</div>
								<div className="flex items-center gap-3">
									{!isRecording ? (
										<button onClick={startRecording} className="btn-secondary btn-sm flex-1 text-xs">🎤 Start Recording</button>
									) : (
										<button onClick={stopRecording} className="btn-danger btn-sm flex-1 text-xs">⏹ Stop Recording</button>
									)}
									<button onClick={endMeeting} className="btn-danger btn-sm flex-1 text-xs">📞 End Consultation</button>
								</div>
								<p className="text-[10px] text-text-secondary mt-3 text-center">
									🔴 Audio is being captured for AI transcript generation.
								</p>
								{/* Live Transcript Display */}
								{scribeListening && scribeText && (
									<div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-clinical max-h-32 overflow-y-auto">
										<p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">🎙️ Live Transcript</p>
										<p className="text-xs text-text-primary whitespace-pre-wrap">{scribeText}</p>
									</div>
								)}
								{scribeSaved && (
									<div className="mt-3 bg-success-50 border border-success-200 text-success-700 rounded-clinical px-3 py-2 text-xs">
										✅ Transcript saved ({Math.floor(scribeDuration / 60)}m {scribeDuration % 60}s)
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* ── PATIENT QUERIES TAB ── */}
			{activeTab === 'queries' && (
				<div className="card animate-fade-in">
					<div className="flex items-center gap-2 mb-4">
						<span className="text-lg">💬</span>
						<h3 className="font-semibold text-text-primary">Patient Queries</h3>
						<span className="badge-amber text-[10px]">Escalated from AI Chatbot</span>
					</div>
					<PatientQueriesTab appointmentId={appointment.id} />
				</div>
			)}
		</div>
	);
}
