import { useState, useEffect, useRef } from 'react';
import useConsultationTimer from '../../hooks/useConsultationTimer.js';
import apiService from '../../services/api.js';

// ── Rich AI Summary Renderer ─────────────────────────────────────────────────
function SummarySection({ icon, title, children }) {
	return (
		<div className="mb-4">
			<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
				<span>{icon}</span>{title}
			</p>
			{children}
		</div>
	);
}

function RichAiSummary({ data, summaryError, loadingSummary }) {
	if (loadingSummary) return (
		<div className="space-y-3 animate-pulse">
			{[100, 75, 90, 60].map((w, i) => (
				<div key={i} className="h-3 bg-ai-100 rounded" style={{ width: `${w}%` }} />
			))}
			<p className="text-xs text-ai-500 flex items-center gap-1.5 mt-3">
				<span className="w-3 h-3 border-2 border-ai-300 border-t-ai-600 rounded-full animate-spin inline-block" />
				Generating AI summary… (Ollama may take 15–40s on first load)
			</p>
		</div>
	);

	if (summaryError && !data) return (
		<div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 rounded-clinical border border-amber-200">
			<span>⚠️</span> {summaryError}
		</div>
	);

	if (!data) return null;

	const riskColors = { high: 'badge-danger', moderate: 'badge-amber', low: 'badge-success', unknown: 'badge-gray' };
	const flagIcons  = { high: '⬆️', low: '⬇️', critical: '🚨', normal: '✅', unknown: '❓' };

	return (
		<div className="space-y-1">
			{/* Status + Risk */}
			<div className="flex items-center justify-between mb-3">
				<span className="text-xs text-success-600 flex items-center gap-1">
					<span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" /> Summary Ready
				</span>
				{data.riskLevel && (
					<span className={`badge text-[10px] ${riskColors[data.riskLevel] || 'badge-gray'}`}>
						Risk: {data.riskLevel?.toUpperCase()}
					</span>
				)}
			</div>

			{/* Patient Overview */}
			{data.patientOverview && (
				<SummarySection icon="👤" title="Patient Overview">
					<p className="text-sm text-text-secondary leading-relaxed p-3 bg-white/60 rounded-clinical border border-ai-100">
						{data.patientOverview}
					</p>
				</SummarySection>
			)}

			{/* Lab Findings */}
			{data.labFindings?.length > 0 && (
				<SummarySection icon="🧪" title="Lab Findings">
					<div className="space-y-1.5">
						{data.labFindings.map((f, i) => (
							<div key={i} className="flex items-start gap-2 text-xs p-2 bg-white/60 rounded border border-gray-100">
								<span className="shrink-0">{flagIcons[f.flag] || '❓'}</span>
								<div>
									<span className="font-medium text-text-primary">{typeof f === 'string' ? f : f.test}</span>
									{f.value && <span className="text-text-secondary ml-1">{f.value}</span>}
									{f.note  && <p className="text-text-secondary mt-0.5">{f.note}</p>}
								</div>
							</div>
						))}
					</div>
				</SummarySection>
			)}

			{/* Medications */}
			{data.prescriptions?.length > 0 && (
				<SummarySection icon="💊" title="Current Medications">
					<div className="flex flex-wrap gap-1.5">
						{data.prescriptions.map((p, i) => (
							<span key={i} className="px-2 py-1 bg-primary-50 border border-primary-100 rounded-full text-xs text-primary-700">
								{typeof p === 'string' ? p : `${p.name} ${p.dosage}`}
							</span>
						))}
					</div>
				</SummarySection>
			)}

			{/* Concerns */}
			{data.concerns?.length > 0 && (
				<SummarySection icon="⚠️" title="Current Concerns">
					<ul className="space-y-1">
						{data.concerns.map((c, i) => (
							<li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
								<span className="text-amber-500 shrink-0 mt-0.5">●</span>{c}
							</li>
						))}
					</ul>
				</SummarySection>
			)}

			{/* Insights */}
			{data.insights?.length > 0 && (
				<SummarySection icon="💡" title="Clinical Insights">
					<ul className="space-y-1">
						{data.insights.map((ins, i) => (
							<li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
								<span className="text-ai-500 shrink-0 mt-0.5">●</span>{ins}
							</li>
						))}
					</ul>
				</SummarySection>
			)}
		</div>
	);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ConsultationPrep({ appointment, onBack }) {
	const [aiSummary, setAiSummary]         = useState(null);
	const [editablePoints, setEditablePoints] = useState([]);
	const [newPoint, setNewPoint]           = useState('');
	const [uploadedFiles, setUploadedFiles] = useState(appointment?.linkedRecords || []);
	const [uploading, setUploading]         = useState(false);
	const [loadingSummary, setLoadingSummary] = useState(true);
	const [summaryError, setSummaryError]   = useState('');
	const [meetingActive, setMeetingActive] = useState(false);
	const [isRecording, setIsRecording]     = useState(false);
	const fileInputRef    = useRef(null);
	const mediaRecorderRef = useRef(null);
	const audioChunksRef  = useRef([]);

	const timer = useConsultationTimer(
		appointment?.date,
		appointment?.startTime,
		appointment?.status
	);

	// Re-render every 30s so meeting activation updates reactively
	const [, forceUpdate] = useState(0);
	useEffect(() => {
		const interval = setInterval(() => forceUpdate(n => n + 1), 30000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => { loadAiSummary(); }, [appointment?.id]);

	async function loadAiSummary() {
		setLoadingSummary(true);
		setSummaryError('');

		// Retry up to 2 times with 5s delay — Ollama can be slow on first load
		const MAX_RETRIES = 2;
		let lastError = null;

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				// Race the API call against a 90s timeout
				const res = await Promise.race([
					apiService.getAiSummary(appointment.id),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error('AI summary timed out. Ollama may be slow — try again.')), 90000)
					)
				]);
				if (res.success) {
					setAiSummary(res.data);
					setEditablePoints(
						res.data?.discussionPoints ||
						res.data?.editablePoints   ||
						res.data?.keyFindings      ||
						[]
					);
					setLoadingSummary(false);
					return; // success — exit
				}
			} catch (err) {
				lastError = err;
				if (attempt < MAX_RETRIES) {
					setSummaryError(`Attempt ${attempt + 1} failed. Retrying...`);
					await new Promise(r => setTimeout(r, 5000)); // wait 5s before retry
				}
			}
		}

		// All retries exhausted
		setSummaryError(
			lastError?.message?.includes('timed out')
				? 'AI summary timed out. Ollama may still be loading the model. Try refreshing in 30 seconds.'
				: 'Could not load AI summary. Using default discussion points.'
		);
		setEditablePoints([
			'Review recent medication changes',
			'Discuss any new symptoms',
			'Follow up on previous lab results'
		]);
		setLoadingSummary(false);
	}

	// ── Summary Editing ──────────────────────────────────────────────────────
	function addPoint() {
		if (newPoint.trim() && !timer.summaryLocked) {
			setEditablePoints(prev => [...prev, newPoint.trim()]);
			setNewPoint('');
		}
	}
	function removePoint(index) {
		if (!timer.summaryLocked) setEditablePoints(prev => prev.filter((_, i) => i !== index));
	}
	function updatePoint(index, value) {
		if (!timer.summaryLocked) setEditablePoints(prev => prev.map((p, i) => i === index ? value : p));
	}
	async function saveSummaryEdits() {
		if (timer.summaryLocked) return;
		try { await apiService.updateAiSummary(appointment.id, { editablePoints }); } catch {}
	}

	// ── File Upload ──────────────────────────────────────────────────────────
	async function handleFileUpload(e) {
		const files = Array.from(e.target.files);
		if (files.length === 0 || timer.uploadsLocked) return;
		setUploading(true);
		try {
			for (const file of files) {
				const res = await apiService.uploadConsultationRecord(appointment.id, file);
				if (res.success) {
					setUploadedFiles(prev => [...prev, {
						fileName: file.name, fileType: file.type,
						uploadedAt: new Date().toISOString(), fileUrl: res.data?.fileUrl || '#'
					}]);
					try{await apiService.uploadMedicalRecord(file,file.name,"Consultation Upload");}catch(e){console.warn(e.message);}
				}
			}
		} catch (err) { console.error('Upload failed:', err); }
		finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	}

	function handleDrop(e) {
		e.preventDefault();
		if (timer.uploadsLocked) return;
		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) {
			const dt = new DataTransfer();
			files.forEach(f => dt.items.add(f));
			if (fileInputRef.current) {
				fileInputRef.current.files = dt.files;
				handleFileUpload({ target: { files: dt.files } });
			}
		}
	}

	// ── Meeting / Recording ──────────────────────────────────────────────────
	function joinMeeting() { if (timer.meetingEnabled) setMeetingActive(true); }

	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
			audioChunksRef.current = [];
			mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
			mediaRecorderRef.current = mediaRecorder;
			mediaRecorder.start(1000);
			setIsRecording(true);
		} catch (err) { console.error('Could not start recording:', err); }
	}

	function stopRecording() {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
			mediaRecorderRef.current.stop();
			mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
			setIsRecording(false);
		}
	}

	async function endMeeting() {
		stopRecording();
		setMeetingActive(false);
		try {
			await apiService.completeConsultation(appointment.id, {
				rawText: '[Meeting completed — transcript processing...]',
				durationSeconds: Math.round((Date.now() - new Date(appointment.date).getTime()) / 1000),
				hasAudio: audioChunksRef.current.length > 0
			});
		} catch (err) { console.error('Error completing consultation:', err); }
	}

	// ── Phase Banner ─────────────────────────────────────────────────────────
	function PhaseBanner() {
		const configs = {
			'waiting':        { bg: 'bg-primary-50 border-primary-200',  icon: '⏳', title: 'Preparing for Consultation',          text: `Starts in ${timer.formattedCountdown}. Upload records and review your summary.` },
			'uploads-locked': { bg: 'bg-amber-50 border-amber-200',      icon: '📎', title: 'Uploads Locked — Summary Still Editable', text: `Meeting opens soon. You can still edit summary points.` },
			'summary-locked': { bg: 'bg-ai-50 border-ai-200',            icon: '🔒', title: 'Summary Locked & Shared with Doctor',  text: 'Your summary has been shared with the doctor. Meeting is ready to join.' },
			'active':         { bg: 'bg-success-50 border-success-200',  icon: '🟢', title: 'Consultation In Progress',             text: 'Your appointment has started.' },
			'completed':      { bg: 'bg-gray-50 border-gray-200',        icon: '✅', title: 'Consultation Completed',               text: 'View your records in the Recent Consultations section.' },
		};
		const c = configs[timer.phase] || configs.waiting;
		return (
			<div className={`flex items-center gap-3 p-4 rounded-clinical border ${c.bg} animate-fade-in`}>
				<span className="text-2xl shrink-0">{c.icon}</span>
				<div className="flex-1">
					<p className="text-sm font-semibold text-text-primary">{c.title}</p>
					<p className="text-xs text-text-secondary mt-0.5">{c.text}</p>
				</div>
				<div className="text-right shrink-0">
					<div className={`text-lg font-bold font-mono ${timer.minutesUntilStart <= 5 ? 'text-danger-500 animate-pulse-soft' : 'text-primary-600'}`}>
						{timer.formattedCountdown}
					</div>
					<p className="text-[10px] text-text-secondary uppercase tracking-wider">
						{timer.isStarted ? 'Elapsed' : 'Countdown'}
					</p>
				</div>
			</div>
		);
	}

	const doctorName = typeof appointment.doctor === 'object' ? appointment.doctor.name : appointment.doctor;

	return (
		<div className="space-y-6 animate-fade-in">
			{/* Header */}
			<div className="flex items-center gap-4">
				<button onClick={onBack} className="btn-ghost btn-sm text-xs">← Back</button>
				<div className="flex-1">
					<h1 className="text-2xl font-bold text-text-primary">Consultation Preparation</h1>
					<p className="text-text-secondary text-sm mt-0.5">
						{doctorName} • {appointment.date} at {appointment.startTime}
					</p>
				</div>
				<span className="badge-ai">
					<span className="w-1.5 h-1.5 rounded-full bg-ai-500 animate-pulse-soft" />
					AI Powered
				</span>
			</div>

			<PhaseBanner />

			<div className="grid lg:grid-cols-2 gap-6">
				{/* ── SECTION A: Summary + Upload ── */}
				<div className="space-y-5">
					{/* AI Summary Card */}
					<div className={`card-ai ${timer.summaryLocked ? 'opacity-90' : ''}`}>
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<span className="text-lg">🧠</span>
								<h3 className="font-semibold text-text-primary">AI-Generated Briefing</h3>
							</div>
							{timer.summaryLocked && <span className="badge-ai text-[10px]">🔒 Locked</span>}
						</div>

						{/* Rich structured summary */}
						<RichAiSummary
							data={aiSummary}
							summaryError={summaryError}
							loadingSummary={loadingSummary}
						/>

						{/* Editable Discussion Points */}
						{!loadingSummary && (
							<div className="space-y-2 mt-4 pt-4 border-t border-ai-100">
								<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
									🎯 Discussion Points {timer.summaryLocked ? '(Locked)' : '(Editable)'}
								</p>
								{editablePoints.map((point, i) => (
									<div key={i} className="flex items-center gap-2 group">
										<span className="text-ai-400 text-xs shrink-0">●</span>
										{timer.summaryLocked ? (
											<span className="text-sm text-text-primary flex-1">{point}</span>
										) : (
											<input type="text" value={point}
												onChange={(e) => updatePoint(i, e.target.value)}
												onBlur={saveSummaryEdits}
												className="input text-sm flex-1 py-1.5 px-2 bg-white/80"
											/>
										)}
										{!timer.summaryLocked && (
											<button onClick={() => removePoint(i)}
												className="text-danger-400 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
												✕
											</button>
										)}
									</div>
								))}
								{!timer.summaryLocked && (
									<div className="flex gap-2 mt-2">
										<input type="text" value={newPoint}
											onChange={(e) => setNewPoint(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && addPoint()}
											placeholder="Add a discussion point..."
											className="input text-sm flex-1 py-1.5 px-2"
										/>
										<button onClick={addPoint} className="btn-ai btn-sm text-xs" disabled={!newPoint.trim()}>
											+ Add
										</button>
									</div>
								)}
							</div>
						)}

						<p className="text-[10px] text-text-secondary mt-4">
							⚕️ AI-generated summary. Always discuss with your doctor.
						</p>
					</div>

					{/* Upload Section */}
					<div className={`card ${timer.uploadsLocked ? 'opacity-75' : ''}`}>
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<span className="text-lg">📎</span>
								<h3 className="font-semibold text-text-primary">Medical Records</h3>
							</div>
							{timer.uploadsLocked && <span className="badge-amber text-[10px]">🔒 Locked</span>}
						</div>

						{timer.uploadsLocked && (
							<div className="bg-amber-50 border border-amber-200 rounded-clinical p-3 mb-4 text-xs text-amber-700">
								{timer.lockMessages?.uploads || 'Uploads are locked before the consultation.'}
							</div>
						)}

						{!timer.uploadsLocked && (
							<div
								onDrop={handleDrop}
								onDragOver={(e) => e.preventDefault()}
								className="border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-clinical p-6 text-center transition-colors cursor-pointer mb-4"
								onClick={() => fileInputRef.current?.click()}
							>
								<input ref={fileInputRef} type="file" multiple
									accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
									onChange={handleFileUpload} className="hidden"
								/>
								{uploading ? (
									<div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
										<div className="w-4 h-4 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
										Uploading...
									</div>
								) : (
									<>
										<span className="text-3xl block mb-2 opacity-60">📤</span>
										<p className="text-sm text-text-secondary">
											Drop files here or <span className="text-primary-600 font-medium">browse</span>
										</p>
										<p className="text-[11px] text-text-secondary mt-1">PDF, images, or documents up to 10MB each</p>
									</>
								)}
							</div>
						)}

						{uploadedFiles.length > 0 && (
							<div className="space-y-2">
								{uploadedFiles.map((file, i) => (
									<div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-clinical text-sm">
										<span className="text-base">{file.fileType?.includes('pdf') ? '📕' : '🖼️'}</span>
										<div className="flex-1 min-w-0">
											<p className="text-text-primary truncate text-xs font-medium">{file.fileName}</p>
											<p className="text-[10px] text-text-secondary">{new Date(file.uploadedAt).toLocaleString()}</p>
										</div>
										<span className="badge-success text-[10px]">✓ Uploaded</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* ── SECTION B: Video Consultation ── */}
				<div className="space-y-5">
					<div className={`card h-full flex flex-col ${!timer.meetingEnabled && !meetingActive ? 'opacity-60' : ''}`}>
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<span className="text-lg">🎥</span>
								<h3 className="font-semibold text-text-primary">Video Consultation</h3>
							</div>
							{isRecording && (
								<span className="badge-danger text-[10px] animate-pulse-soft">
									<span className="w-2 h-2 rounded-full bg-danger-500" /> Recording
								</span>
							)}
						</div>

						{!meetingActive ? (
							<div className="flex-1 flex flex-col items-center justify-center text-center p-6">
								{!timer.meetingEnabled ? (
									<>
										<div className="relative w-full aspect-video bg-gray-100 rounded-clinical mb-5 flex items-center justify-center overflow-hidden">
											<div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 opacity-80" />
											<div className="relative z-10 text-center">
												<span className="text-5xl block mb-3 opacity-40 grayscale">🎥</span>
												<p className="text-sm font-semibold text-text-secondary">Meeting Room</p>
												<p className="text-xs text-text-secondary mt-1">Activates 15 minutes before consultation</p>
											</div>
										</div>
										<div className="bg-gray-50 rounded-clinical p-4 w-full">
											<p className="text-sm font-semibold text-text-primary">
												⏱ Activates in {Math.max(0, Math.floor(timer.minutesUntilStart - 15))} minutes
											</p>
											<p className="text-xs text-text-secondary mt-1">
												The video consultation will be available 15 minutes before your scheduled time.
											</p>
										</div>
									</>
								) : (
									<>
										<div className="relative w-full aspect-video bg-gradient-to-br from-primary-50 to-ai-50 rounded-clinical mb-5 flex items-center justify-center border border-primary-200 overflow-hidden">
											<div className="absolute inset-0 animate-ai-pulse opacity-30" />
											<div className="relative z-10 text-center">
												<span className="text-5xl block mb-3">🩺</span>
												<p className="text-sm font-semibold text-primary-700">🟢 Ready to Join</p>
												<p className="text-xs text-text-secondary mt-1">{doctorName} is waiting</p>
											</div>
										</div>
										<button onClick={joinMeeting} className="btn-primary btn-lg w-full">
											🎥 Join Meeting Now
										</button>
									</>
								)}
							</div>
						) : (
							<div className="flex-1 flex flex-col">
								<div className="rounded-xl overflow-hidden border-2 border-primary-500 shadow-2xl bg-gray-900 mb-4" style={{ height: 420 }}>
									<iframe
										src={`https://meet.jit.si/${appointment.id}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableModeratorIndicator=true&config.enableWelcomePage=false&config.enableClosePage=false&userInfo.displayName=Patient`}
										style={{ width: '100%', height: '100%', border: 'none', minHeight: '420px' }}
										allow="camera; microphone; display-capture; autoplay"
										title="ClinIQ Video Consultation"
									/>
								</div>
								<div className="flex items-center gap-3">
									{!isRecording ? (
										<button onClick={startRecording} className="btn-secondary btn-sm flex-1 text-xs">🎤 Start Recording</button>
									) : (
										<button onClick={stopRecording} className="btn-danger btn-sm flex-1 text-xs">⏹ Stop Recording</button>
									)}
									<button onClick={endMeeting} className="btn-danger btn-sm flex-1 text-xs">📞 End Meeting</button>
								</div>
								<p className="text-[10px] text-text-secondary mt-3 text-center">
									🔴 Audio is being captured for AI transcript generation.
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
