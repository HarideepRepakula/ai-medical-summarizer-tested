import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout.jsx';
import AIScribe from '../../components/AIScribe.jsx';
import CDSSAlert from '../../components/CDSSAlert.jsx';
import DoctorConsultationView from '../../components/appointments/DoctorConsultationView.jsx';
import DoctorConsultationRecords from '../../components/appointments/DoctorConsultationRecords.jsx';
import apiService from '../../services/api.js';
import authService from '../../services/authService.js';

function RescheduleCancelModal({ appointment, onClose, onDone }) {
	const [mode, setMode] = useState('choose');
	const [newDate, setNewDate] = useState('');
	const [newStart, setNewStart] = useState('');
	const [newEnd, setNewEnd] = useState('');
	const [reason, setReason] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const patientName = typeof appointment.patient === 'object' ? appointment.patient.name : appointment.patient;

	async function handleReschedule() {
		if (!newDate || !newStart || !newEnd) { setError('Please fill all fields.'); return; }
		setLoading(true); setError('');
		try {
			await apiService.rescheduleAppointment(appointment.id, { newDate, newStartTime: newStart, newEndTime: newEnd, reason });
			onDone('Appointment rescheduled successfully.');
		} catch (err) { setError(err.message || 'Failed to reschedule.'); }
		finally { setLoading(false); }
	}

	async function handleCancel() {
		if (!reason.trim()) { setError('Please provide a reason.'); return; }
		setLoading(true); setError('');
		try {
			await apiService.cancelAppointment(appointment.id, { reason });
			onDone('Appointment cancelled successfully.');
		} catch (err) { setError(err.message || 'Failed to cancel.'); }
		finally { setLoading(false); }
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
			<div className="bg-white rounded-clinical shadow-clinical-lg w-full max-w-md mx-4 p-6 animate-fade-in">
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-text-primary">Reschedule / Cancel</h3>
					<button onClick={onClose} className="text-text-secondary hover:text-text-primary text-lg">✕</button>
				</div>
				<p className="text-sm text-text-secondary mb-4">
					Patient: <span className="font-medium text-text-primary">{patientName}</span> — {appointment.date} at {appointment.startTime}
				</p>

				{mode === 'choose' && (
					<div className="flex gap-3">
						<button onClick={() => setMode('reschedule')} className="btn-secondary flex-1">📅 Reschedule</button>
						<button onClick={() => setMode('cancel')} className="btn-danger flex-1">✕ Cancel</button>
					</div>
				)}

				{mode === 'reschedule' && (
					<div className="space-y-3">
						<div>
							<label className="label">New Date</label>
							<input type="date" className="input" value={newDate} onChange={e => setNewDate(e.target.value)} />
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="label">Start Time</label>
								<input type="time" className="input" value={newStart} onChange={e => setNewStart(e.target.value)} />
							</div>
							<div>
								<label className="label">End Time</label>
								<input type="time" className="input" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
							</div>
						</div>
						<div>
							<label className="label">Reason (optional)</label>
							<input type="text" className="input" placeholder="Reason for rescheduling..." value={reason} onChange={e => setReason(e.target.value)} />
						</div>
						{error && <p className="text-xs text-danger-600">{error}</p>}
						<div className="flex gap-2">
							<button onClick={() => setMode('choose')} className="btn-ghost flex-1">← Back</button>
							<button onClick={handleReschedule} disabled={loading} className="btn-primary flex-1">
								{loading ? 'Rescheduling...' : 'Confirm Reschedule'}
							</button>
						</div>
					</div>
				)}

				{mode === 'cancel' && (
					<div className="space-y-3">
						<div>
							<label className="label">Reason for Cancellation</label>
							<textarea className="input resize-none" rows={3} placeholder="Provide a reason..." value={reason} onChange={e => setReason(e.target.value)} />
						</div>
						{error && <p className="text-xs text-danger-600">{error}</p>}
						<div className="flex gap-2">
							<button onClick={() => setMode('choose')} className="btn-ghost flex-1">← Back</button>
							<button onClick={handleCancel} disabled={loading} className="btn-danger flex-1">
								{loading ? 'Cancelling...' : 'Confirm Cancel'}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function DoctorRecentConsultations({ appointments, onViewRecords }) {
	const completed = appointments.filter(a => a.status === 'completed');

	if (completed.length === 0) return (
		<div className="card">
			<h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
				<span className="text-xl">📋</span> Recent Consultations
			</h3>
			<div className="text-center py-12">
				<span className="text-5xl block mb-3 opacity-60">📝</span>
				<p className="text-text-secondary text-sm">No completed consultations yet.</p>
			</div>
		</div>
	);

	return (
		<div className="card overflow-hidden p-0">
			<div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
				<span className="text-xl">📋</span>
				<h3 className="font-semibold text-text-primary">Recent Consultations</h3>
				<span className="badge-gray text-[10px]">{completed.length}</span>
			</div>
			<div className="overflow-x-auto">
				<table className="table-clinical">
					<thead>
						<tr><th>Patient</th><th>Reason</th><th>Date</th><th>Time</th><th>Action</th></tr>
					</thead>
					<tbody>
						{completed.map(apt => {
							const name = typeof apt.patient === 'object' ? apt.patient.name : apt.patient;
							const hasRecords = apt.consultationRecords?.meetingSummary || apt.consultationRecords?.meetingTranscript;
							return (
								<tr key={apt.id} className="group">
									<td>
										<div className="flex items-center gap-3">
											<div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
												{name?.[0] || 'P'}
											</div>
											<p className="font-medium text-text-primary text-sm">{name}</p>
										</div>
									</td>
									<td className="text-sm max-w-[200px] truncate" title={apt.reason}>{apt.reason}</td>
									<td className="text-sm whitespace-nowrap">{apt.date}</td>
									<td className="text-sm whitespace-nowrap">{apt.startTime} – {apt.endTime}</td>
									<td>
										<div className="flex items-center gap-2">
											<button
												onClick={() => onViewRecords(apt)}
												className="btn-secondary btn-sm text-xs whitespace-nowrap group-hover:border-primary-300 group-hover:text-primary-700 transition-all"
											>
												📄 Consultation Records
											</button>
											{hasRecords && (
												<span className="badge-ai text-[10px]">
													<span className="w-1.5 h-1.5 rounded-full bg-ai-500" /> AI Records
												</span>
											)}
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default function DoctorDashboard() {
	const [activeTab, setActiveTab] = useState('dashboard');
	const [appointments, setAppointments] = useState([]);
	const [patients, setPatients] = useState([]);
	const [selectedAppointment, setSelectedAppointment] = useState(null);
	const [consultView, setConsultView] = useState(null);
	const [recordsView, setRecordsView] = useState(null);
	const [reschedulingApt, setReschedulingApt] = useState(null);
	const [cdssTarget, setCdssTarget] = useState(null);
	const [toast, setToast] = useState(null);
	const [currentUser, setCurrentUser] = useState(null);
	const navigate = useNavigate();

	useEffect(() => {
		if (!authService.isAuthenticated()) { navigate('/login'); return; }
		const user = authService.getCurrentUser();
		if (!user || user.role !== 'DOCTOR') { navigate('/login'); return; }
		setCurrentUser(user);
		loadAppointments();
		loadPatients();
	}, []);

	const loadAppointments = async () => {
		try {
			const res = await apiService.getAppointments();
			setAppointments(res.data?.appointments || res.appointments || []);
		} catch { setAppointments([]); }
	};

	const loadPatients = async () => {
		try {
			const res = await apiService.getDoctors();
			setPatients(res.patients || []);
		} catch { setPatients([]); }
	};

	const showToast = (msg, type = 'info') => {
		setToast({ message: msg, type });
		setTimeout(() => setToast(null), 3500);
	};

	function openConsultView(apt) { setConsultView(apt); setActiveTab('consult-view'); }
	function openRecordsView(apt) { setRecordsView(apt); setActiveTab('records-view'); }
	function backFromConsultView() { setConsultView(null); setActiveTab('appointments'); loadAppointments(); }
	function backFromRecordsView() { setRecordsView(null); setActiveTab('appointments'); }

	const upcomingAppointments = appointments.filter(a => a.status !== 'completed' && a.status !== 'cancelled');

	// Null guard — wait for JWT decode before rendering
	if (!currentUser) return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
		</div>
	);

	return (
		<AppLayout role="DOCTOR" activeTab={activeTab} onTabChange={tab => {
			if (tab !== 'consult-view') setConsultView(null);
			if (tab !== 'records-view') setRecordsView(null);
			setActiveTab(tab);
		}} userName={currentUser.name || currentUser.email}>

			{toast && (
				<div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-clinical shadow-clinical-lg text-sm font-medium animate-slide-up ${
					toast.type === 'success' ? 'bg-success-50 text-success-700 border border-success-200' :
					toast.type === 'error'   ? 'bg-danger-50 text-danger-700 border border-danger-200' :
					'bg-primary-50 text-primary-700 border border-primary-200'
				}`}>{toast.message}</div>
			)}

			{reschedulingApt && (
				<RescheduleCancelModal
					appointment={reschedulingApt}
					onClose={() => setReschedulingApt(null)}
					onDone={msg => { setReschedulingApt(null); showToast(msg, 'success'); loadAppointments(); }}
				/>
			)}

			{activeTab === 'consult-view' && consultView && (
				<DoctorConsultationView appointment={consultView} onBack={backFromConsultView} />
			)}

			{activeTab === 'records-view' && recordsView && (
				<DoctorConsultationRecords appointment={recordsView} onBack={backFromRecordsView} />
			)}

			{/* ── DASHBOARD ── */}
			{activeTab === 'dashboard' && (
				<div className="space-y-6 animate-fade-in">
					<div>
						<h1 className="text-2xl font-bold">Doctor Dashboard</h1>
						<p className="text-text-secondary mt-1">Welcome back, {currentUser.name || currentUser.email}</p>
					</div>

					<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{ label: 'Upcoming Appointments', value: upcomingAppointments.length, icon: '📅', color: 'text-primary-600', bg: 'bg-primary-50' },
							{ label: 'Total Patients',        value: patients.length,              icon: '👥', color: 'text-success-600', bg: 'bg-success-50' },
							{ label: 'Completed',             value: appointments.filter(a => a.status === 'completed').length, icon: '✅', color: 'text-ai-600', bg: 'bg-ai-50' },
						].map((kpi, i) => (
							<div key={i} className="card-stat">
								<div className={`w-12 h-12 ${kpi.bg} rounded-clinical flex items-center justify-center text-xl shrink-0`}>{kpi.icon}</div>
								<div>
									<div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
									<div className="text-xs text-text-secondary">{kpi.label}</div>
								</div>
							</div>
						))}
					</div>

					<div className="card">
						<h3 className="font-semibold mb-4">Today's Schedule</h3>
						{upcomingAppointments.length > 0 ? upcomingAppointments.map(apt => {
							const name = typeof apt.patient === 'object' ? apt.patient.name : apt.patient;
							return (
								<div key={apt.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
									<div>
										<p className="text-sm font-medium">{name}</p>
										<p className="text-xs text-text-secondary">{apt.startTime} — {apt.reason}</p>
									</div>
									<div className="flex items-center gap-2">
										<span className={`badge ${apt.status === 'confirmed' ? 'badge-success' : apt.status === 'pending' ? 'badge-amber' : 'badge-gray'}`}>
											{apt.status?.toUpperCase()}
										</span>
										<button className="btn-primary btn-sm text-xs" onClick={() => openConsultView(apt)}>
											🩺 Consult
										</button>
									</div>
								</div>
							);
						}) : (
							<div className="text-center py-8 text-text-secondary text-sm">No upcoming appointments.</div>
						)}
					</div>

					<DoctorRecentConsultations appointments={appointments} onViewRecords={openRecordsView} />
				</div>
			)}

			{/* ── APPOINTMENTS ── */}
			{activeTab === 'appointments' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">Appointments</h1>

					<div className="card overflow-hidden p-0">
						<div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
							<span className="text-lg">📅</span>
							<h3 className="font-semibold text-text-primary">Upcoming Appointments</h3>
							<span className="badge-gray text-[10px]">{upcomingAppointments.length}</span>
						</div>
						<table className="table-clinical">
							<thead>
								<tr><th>Patient</th><th>Reason</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr>
							</thead>
							<tbody>
								{upcomingAppointments.length > 0 ? upcomingAppointments.map(apt => {
									const name = typeof apt.patient === 'object' ? apt.patient.name : apt.patient;
									return (
										<tr key={apt.id}>
											<td>
												<div className="flex items-center gap-2">
													<div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
														{name?.[0] || 'P'}
													</div>
													<span className="font-medium text-sm">{name}</span>
												</div>
											</td>
											<td className="text-sm max-w-[160px] truncate" title={apt.reason}>{apt.reason}</td>
											<td className="text-sm whitespace-nowrap">{apt.date}</td>
											<td className="text-sm whitespace-nowrap">{apt.startTime}</td>
											<td>
												<span className={`badge ${
													apt.status === 'confirmed'   ? 'badge-success' :
													apt.status === 'in_progress' ? 'badge-ai' : 'badge-amber'
												}`}>{apt.status?.toUpperCase()}</span>
											</td>
											<td>
												<div className="flex items-center gap-2">
													<button className="btn-primary btn-sm text-xs" onClick={() => openConsultView(apt)}>
														🩺 Consult
													</button>
													<button className="btn-secondary btn-sm text-xs" onClick={() => setReschedulingApt(apt)}>
														📅 Reschedule / Cancel
													</button>
												</div>
											</td>
										</tr>
									);
								}) : (
									<tr>
										<td colSpan={6} className="text-center py-10 text-text-secondary text-sm">
											No upcoming appointments.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					<DoctorRecentConsultations appointments={appointments} onViewRecords={openRecordsView} />
				</div>
			)}

			{/* ── PATIENTS ── */}
			{activeTab === 'patients' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">Patients</h1>
					{patients.length === 0 ? (
						<div className="card text-center py-12">
							<span className="text-5xl block mb-3 opacity-60">👥</span>
							<p className="text-text-secondary text-sm">No patients yet. Patients appear here after booking appointments.</p>
						</div>
					) : (
						<div className="card overflow-hidden p-0">
							<table className="table-clinical">
								<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
								<tbody>
									{patients.map((pt, i) => (
										<tr key={pt.id || i}>
											<td className="font-medium">{pt.name}</td>
											<td className="text-sm text-text-secondary">{pt.email || '—'}</td>
											<td className="text-sm text-text-secondary">{pt.phone || '—'}</td>
											<td><button className="btn-ghost btn-sm text-xs">Records</button></td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{/* ── SCHEDULE ── */}
			{activeTab === 'schedule' && (
				<div className="space-y-6 animate-fade-in">
					<div className="section-header">
						<h1 className="text-2xl font-bold">Schedule Management</h1>
						<div className="flex gap-2">
							<button className="btn-primary btn-sm">📅 Add Slot</button>
							<button className="btn-secondary btn-sm">🚫 Block Time</button>
						</div>
					</div>
					<div className="card text-center py-12">
						<span className="text-4xl block mb-3">🗓️</span>
						<p className="text-text-secondary">Manage your availability and time slots here.</p>
					</div>
				</div>
			)}

			{/* ── AI TOOLS ── */}
			{activeTab === 'ai-tools' && (
				<div className="space-y-6 animate-fade-in">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold">AI Clinical Tools</h1>
						<span className="badge-ai">AI Powered</span>
					</div>
					<p className="text-text-secondary -mt-3">AI-powered tools for enhanced clinical decision making</p>

					{selectedAppointment ? (
						<AIScribe appointmentId={selectedAppointment?.id} onSaved={data => showToast(`Transcript saved: ${data.duration}s`, 'success')} />
					) : (
						<div className="card text-center py-8">
							<span className="text-3xl block mb-2">🎙️</span>
							<h4 className="font-semibold mb-1">AI Medical Scribe</h4>
							<p className="text-sm text-text-secondary">Select an appointment from the Appointments tab to start transcription.</p>
						</div>
					)}

					{cdssTarget ? (
						<CDSSAlert medicationName={cdssTarget.medication} patientId={cdssTarget.patientId} onClose={() => setCdssTarget(null)} />
					) : (
						<div className="card">
							<h4 className="font-semibold mb-3">🧬 Clinical Decision Support System</h4>
							<p className="text-sm text-text-secondary mb-4">Check drug interactions and contraindications before prescribing.</p>
							<div className="flex gap-3">
								<input id="cdss-med-input" type="text" placeholder="Enter medication name (e.g., Metformin)" className="input flex-1"
									onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) setCdssTarget({ medication: e.target.value.trim(), patientId: 'demo' }); }} />
								<button className="btn-ai btn-sm" onClick={() => {
									const v = document.getElementById('cdss-med-input')?.value?.trim();
									if (v) setCdssTarget({ medication: v, patientId: 'demo' });
								}}>🔍 Check Safety</button>
							</div>
						</div>
					)}
				</div>
			)}
		</AppLayout>
	);
}
