import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import AppLayout from '../../layouts/AppLayout.jsx';
import UpcomingAppointments from '../../components/appointments/UpcomingAppointments.jsx';
import RecentConsultations from '../../components/appointments/RecentConsultations.jsx';
import ConsultationPrep from '../../components/appointments/ConsultationPrep.jsx';
import ConsultationRecords from '../../components/appointments/ConsultationRecords.jsx';
import HealthTimeline from '../../components/HealthTimeline.jsx';
import RAGChatbot from '../../components/RAGChatbot.jsx';
import AIHealthInsights from '../../components/AIHealthInsights.jsx';
import PharmacyStore from '../../components/PharmacyStore.jsx';
import VerifiedBadge from '../../components/VerifiedBadge.jsx';
import apiService from '../../services/api.js';
import authService from '../../services/authService.js';

export default function PatientDashboard() {
	const [activeTab, setActiveTab] = useState('dashboard');
	const [doctors, setDoctors] = useState([]);
	const [appointments, setAppointments] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedSpecialty, setSelectedSpecialty] = useState('');
	const [toast, setToast] = useState(null);
	const [currentUser, setCurrentUser] = useState(null);
	const [loading, setLoading] = useState(true);

	// Sub-view state for consultation preparation / records
	const [selectedAppointment, setSelectedAppointment] = useState(null);
	const [subView, setSubView] = useState(null); // 'consultation-prep' | 'consultation-records'

	// Booking modal –” step machine: 'form' | 'payment' | 'success'
	const [bookingDoctor, setBookingDoctor]     = useState(null);
	const [bookingStep, setBookingStep]         = useState('form');
	const [bookingForm, setBookingForm]         = useState({ date: '', startTime: '', endTime: '', reason: '' });
	const [bookingLoading, setBookingLoading]   = useState(false);
	const [paymentLoading, setPaymentLoading]   = useState(false);
	const [bookedOtp, setBookedOtp]             = useState('');
	const [bookedInfo, setBookedInfo]           = useState(null);
	const [visitTypeFilter, setVisitTypeFilter] = useState('all');

	const [labResults, setLabResults]         = useState([]);
	const [medicalRecords, setMedicalRecords] = useState([]);
	const [recordsLoading, setRecordsLoading] = useState(false);
	const [uploadMsg, setUploadMsg]           = useState('');
	const [uploading, setUploading]           = useState(false);
	const [uploadModal, setUploadModal]       = useState(false);
	const [uploadForm, setUploadForm]         = useState({ recordName: '', type: 'Lab Report', file: null });
	const [viewRecord, setViewRecord]         = useState(null);
	const [bills, setBills]                   = useState([
		{ id: 1, title: 'Consultation Fee', amount: 500,  status: 'paid',    date: '2025-01-20' },
		{ id: 2, title: 'Pharmacy Order',   amount: 1250, status: 'pending', date: '2025-01-22' }
	]);

	const loadLabResults = async () => {
		setRecordsLoading(true);
		try {
			const res = await apiService.getLabResults();
			if (res.success) setLabResults(res.data.labResults || []);
		} catch (err) {
			showToast('Failed to load records: ' + err.message, 'error');
		} finally { setRecordsLoading(false); }
	};

	const loadMedicalRecords = async () => {
		try {
			const res = await apiService.getMedicalRecords();
			if (res.success) setMedicalRecords(res.data.records || []);
		} catch {}
	};

	const handleRecordUpload = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true); setUploadMsg('');
		try {
			const res = await apiService.uploadLabRecord(file);
			if (res.success) {
				setUploadMsg(`✅ ${res.message}`);
				await loadLabResults();
			}
		} catch (err) {
			setUploadMsg('âŒ ' + err.message);
		} finally { setUploading(false); e.target.value = ''; }
	};

	const handleModalUpload = async () => {
		if (!uploadForm.file || !uploadForm.recordName.trim()) return;
		setUploading(true);
		try {
			const res = await apiService.uploadMedicalRecord(uploadForm.file, uploadForm.recordName, uploadForm.type);
			if (res.success) {
				showToast('Record uploaded successfully!', 'success');
				setUploadModal(false);
				setUploadForm({ recordName: '', type: 'Lab Report', file: null });
				await loadMedicalRecords();
			}
		} catch (err) {
			showToast('Upload failed: ' + err.message, 'error');
		} finally { setUploading(false); }
	};

	const downloadAiReport = (record) => {
		const doc = new jsPDF();
		doc.setFillColor(40, 116, 240);
		doc.rect(0, 0, 210, 40, 'F');
		doc.setTextColor(255, 255, 255);
		doc.setFontSize(22);
		doc.text('ClinIQ AI Medical Report', 20, 28);
		doc.setTextColor(0, 0, 0);
		doc.setFontSize(10);
		doc.setFont('helvetica', 'bold');
		doc.text('REPORT INFORMATION', 20, 55);
		doc.setFont('helvetica', 'normal');
		doc.text(`File Name: ${record.recordName}`, 20, 65);
		doc.text(`Category: ${record.fileType}`, 20, 72);
		doc.text(`Analysis Date: ${new Date().toLocaleDateString()}`, 20, 79);
		doc.setDrawColor(200, 200, 200);
		doc.line(20, 85, 190, 85);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(12);
		doc.text('Clinical Summary & Insights:', 20, 95);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(11);
		doc.setTextColor(60, 60, 60);
		const splitText = doc.splitTextToSize(record.aiSummary || 'No summary available.', 170);
		doc.text(splitText, 20, 105);
		doc.setFontSize(8);
		doc.setTextColor(150, 150, 150);
		doc.text('Disclaimer: This is an AI-generated summary by the ClinIQ BART-Large engine.', 20, 280);
		doc.text('Please consult a licensed physician for final medical diagnosis.', 20, 285);
		doc.save(`ClinIQ_Report_${record.recordName.replace(/\s+/g, '_')}.pdf`);
	};

	const handleDeleteRecord = async (id) => {
		try {
			await apiService.deleteMedicalRecord(id);
			setMedicalRecords(prev => prev.filter(r => r.id !== id));
			showToast('Record deleted.', 'success');
		} catch (err) {
			showToast('Delete failed: ' + err.message, 'error');
		}
	};
	const navigate = useNavigate();

	useEffect(() => {
		if (!authService.isAuthenticated()) { navigate('/login'); return; }
		const user = authService.getCurrentUser();
		if (!user || user.role !== 'PATIENT') { navigate('/login'); return; }
		setCurrentUser({ id: user.userId, role: user.role, email: user.email, name: user.name });
		setLoading(false);
		loadDoctors();
		loadAppointmentsForUser(user.userId);
	}, []);

	const loadDoctors = async () => {
		try {
			const res = await apiService.getDoctors();
			setDoctors(res.doctors || []);
		} catch { setDoctors([]); }
	};

	// Accept userId param to avoid race condition with currentUser state
	const loadAppointmentsForUser = async (_userId) => {
		try {
			const res = await apiService.getAppointments();
			const appts = res.data?.appointments || res.appointments || [];
			setAppointments(appts);
		} catch { setAppointments([]); }
	};

	// Keep old name as alias for tab-change refreshes
	const loadAppointments = () => loadAppointmentsForUser(currentUser?.id);

	const showToast = (message, type) => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };

	// â”€â”€ Sub-view navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	function openConsultationPrep(apt) {
		setSelectedAppointment(apt);
		setSubView('consultation-prep');
	}

	function openConsultationRecords(apt) {
		setSelectedAppointment(apt);
		setSubView('consultation-records');
	}

	function closeSubView() {
		setSelectedAppointment(null);
		setSubView(null);
	}

	// Clear sub-view when switching tabs
	function handleTabChange(tab) {
		setActiveTab(tab);
		setSubView(null);
		setSelectedAppointment(null);
		if (tab === 'records') { loadLabResults(); loadMedicalRecords(); }
	}

	// â”€â”€ Booking logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
	const VISIT_TYPES = [
		{ value: 'regular',    label: 'Regular Checkup',    icon: '🩺', desc: 'Routine health checkup' },
		{ value: 'follow-up',  label: 'Follow-up Visit',    icon: '📝”„', desc: 'Follow-up on previous consultation' },
		{ value: 'emergency',  label: 'Urgent Consultation',icon: '🚨', desc: 'Urgent medical concern' },
		{ value: 'specialist', label: 'Specialist Referral', icon: '📝”¬', desc: 'Referred by another doctor' },
	];

	function openBookingModal(doc) {
		const today = new Date().toISOString().split('T')[0];
		setBookingDoctor(doc);
		setBookingStep('form');
		setBookingForm({
			date: today,
			startTime: '10:00',
			endTime: '10:30',
			visitType: visitTypeFilter !== 'all' ? visitTypeFilter : 'regular',
			reason: '',
			uploadedFile: null
		});
	}

	function closeBookingModal() {
		setBookingDoctor(null);
		setBookingStep('form');
		setPaymentLoading(false);
	}

	function proceedToPayment() {
		if (!bookingForm.visitType) { showToast('Please select a visit type', 'error'); return; }
		if (!bookingForm.date)      { showToast('Please select a date', 'error'); return; }
		setBookingStep('payment');
	}

	async function handleFakePayment() {
		setPaymentLoading(true);
		await new Promise(r => setTimeout(r, 2000));
		try {
			await apiService.bookAppointment({
				doctorId:        bookingDoctor.id || bookingDoctor._id,
				appointmentDate: bookingForm.date,
				startTime:       bookingForm.startTime,
				endTime:         bookingForm.endTime,
				reason:          bookingForm.reason || VISIT_TYPES.find(v => v.value === bookingForm.visitType)?.label || 'General Consultation',
				visitType:       bookingForm.visitType,
				urgency:         bookingForm.visitType === 'emergency' ? 'emergency' : 'normal'
			});
			const otp = String(Math.floor(1000 + Math.random() * 9000));
			setBookedOtp(otp);
			setBookedInfo({
				doctorName: bookingDoctor.name,
				date:       bookingForm.date,
				time:       bookingForm.startTime,
				visitType:  VISIT_TYPES.find(v => v.value === bookingForm.visitType)?.label
			});
			setBookingStep('success');
			loadAppointments();
		} catch (err) {
			showToast(err.message || 'Booking failed', 'error');
			setBookingStep('form');
		} finally {
			setPaymentLoading(false);
		}
	}

	const TODAY = new Date().toISOString().split('T')[0];

	const TIME_SLOTS = (() => {
		const slots = [];
		for (let h = 9; h < 17; h++) {
			for (const m of [0, 30]) {
				const start = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
				const endM = m + 30;
				const end = `${String(h + Math.floor(endM/60)).padStart(2,'0')}:${String(endM%60).padStart(2,'0')}`;
				const period = h >= 12 ? 'PM' : 'AM';
				const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
				slots.push({ start, end, label: `${dh}:${String(m).padStart(2,'0')} ${period}` });
			}
		}
		return slots;
	})();

	const availableSlots = TIME_SLOTS.filter(slot => {
		if (bookingForm.date !== TODAY) return true;
		const [h, m] = slot.start.split(':').map(Number);
		return new Date().setHours(h, m, 0, 0) > Date.now();
	});

	if (loading) return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="flex flex-col items-center gap-3">
				<div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
				<span className="text-sm text-text-secondary">Loading dashboard...</span>
			</div>
		</div>
	);

	return (
		<AppLayout role="PATIENT" activeTab={activeTab} onTabChange={handleTabChange} userName={currentUser?.email}>
			{/* Toast */}
			{toast && (
				<div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-clinical shadow-clinical-lg text-sm font-medium animate-slide-up ${
					toast.type === 'success' ? 'bg-success-50 text-success-700 border border-success-200' :
					toast.type === 'error' ? 'bg-danger-50 text-danger-700 border border-danger-200' :
					'bg-primary-50 text-primary-700 border border-primary-200'
				}`}>
					{toast.message}
				</div>
			)}

			{/* â”€â”€ DASHBOARD TAB â”€â”€ */}
			{activeTab === 'dashboard' && (
				<div className="space-y-6 animate-fade-in">
					<div>
						<h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
						<p className="text-text-secondary mt-1">Welcome back! Here's your health overview.</p>
					</div>

					{/* KPI Cards */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						{[
							{ label: 'Appointments', value: appointments.length, icon: '📅', color: 'text-primary-600', bg: 'bg-primary-50' },
							{ label: 'Medical Records', value: labResults.length, icon: '📋', color: 'text-success-600', bg: 'bg-success-50' },
							{ label: 'Pending Bills', value: `₹${bills.filter(b=>b.status==='pending').reduce((s,b)=>s+b.amount,0)}`, icon: '💳', color: 'text-amber-600', bg: 'bg-amber-50' },
							{ label: 'AI Assistant', value: 'Active', icon: '🤖', color: 'text-ai-600', bg: 'bg-ai-50' },
						].map((kpi, i) => (
							<div key={i} className="card-stat">
								<div className={`w-12 h-12 ${kpi.bg} rounded-clinical flex items-center justify-center text-xl shrink-0`}>
									{kpi.icon}
								</div>
								<div>
									<div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
									<div className="text-xs text-text-secondary">{kpi.label}</div>
								</div>
							</div>
						))}
					</div>

					{/* Quick Actions + Recent Appointments grid */}
					<div className="grid lg:grid-cols-2 gap-6">
						<div className="card">
							<h3 className="font-semibold text-text-primary mb-4">Recent Appointments</h3>
							{appointments.length > 0 ? appointments.slice(0, 3).map(apt => (
								<div key={apt.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
									<div>
										<p className="text-sm font-medium text-text-primary">
											{typeof apt.doctor === 'object' ? apt.doctor.name : apt.doctor}
										</p>
										<p className="text-xs text-text-secondary">{apt.date} • {apt.startTime || apt.time}</p>
									</div>
									<span className={`badge ${apt.status === 'confirmed' ? 'badge-success' : apt.status === 'completed' ? 'badge-gray' : 'badge-amber'}`}>
										{apt.status?.toUpperCase()}
									</span>
								</div>
							)) : (
								<div className="text-center py-8 text-text-secondary text-sm">
									<span className="text-3xl block mb-2">📅</span>
									No appointments scheduled
								</div>
							)}
						</div>

						<div className="card">
							<h3 className="font-semibold text-text-primary mb-4">Quick Actions</h3>
							<div className="grid grid-cols-2 gap-3">
								{[
									{ label: 'Book Appointment', icon: '📅', tab: 'doctors' },
									{ label: 'Medical Records', icon: '📋', tab: 'records' },
									{ label: 'My Consultations', icon: '🩺', tab: 'appointments' },
									{ label: 'Order Medicines', icon: '💊', tab: 'pharmacy' },
								].map(action => (
									<button key={action.tab}
										onClick={() => handleTabChange(action.tab)}
										className="flex flex-col items-center gap-2 p-4 rounded-clinical border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 transition-all text-sm font-medium text-text-primary"
									>
										<span className="text-2xl">{action.icon}</span>
										{action.label}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* â”€â”€ DOCTORS TAB â”€â”€ */}
			{activeTab === 'doctors' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">Find Doctors</h1>
					<div className="flex gap-3 flex-wrap">
						<input type="text" placeholder="Search doctors..." value={searchTerm}
							onChange={e => setSearchTerm(e.target.value)} className="input max-w-sm" />
						<select value={selectedSpecialty} onChange={e => setSelectedSpecialty(e.target.value)} className="input w-auto">
							<option value="">All Specialties</option>
							{['Cardiology','Dermatology','Pediatrics','Orthopedics'].map(s => <option key={s}>{s}</option>)}
						</select>
					</div>
					<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{doctors.filter(d => (!searchTerm || d.name.toLowerCase().includes(searchTerm.toLowerCase())) && (!selectedSpecialty || d.specialty === selectedSpecialty))
							.map(doc => (
							<div key={doc.id} className="card hover:shadow-clinical-md transition-shadow">
								<div className="flex items-center gap-3 mb-3">
									<div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
										{doc.name.split(' ').pop()[0]}
									</div>
									<div>
										<h3 className="font-semibold text-text-primary">{doc.name}</h3>
										<p className="text-xs text-primary-600 font-medium">{doc.specialty}</p>
									<div className="mt-1"><VerifiedBadge isVerified={doc.isVerified} size="sm" /></div>
									</div>
								</div>
								<div className="flex items-center justify-between text-sm text-text-secondary mb-4">
									<span>{doc.experience}</span>
									<span>⭐ {doc.rating?.toFixed(1)}</span>
								</div>
								<button className="btn-primary w-full btn-sm"
									onClick={() => openBookingModal(doc)}>
									Book Appointment
								</button>
							</div>
						))}
					</div>

					{/* â”€â”€ Booking Modal â”€â”€ */}
					{bookingDoctor && (
						<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setBookingDoctor(null)}>
							<div className="bg-white rounded-2xl shadow-clinical-lg w-full max-w-lg p-0 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
								{/* Header */}
								<div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 pt-5 pb-4 flex items-center gap-3 z-10">
									<div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-lg">
										{bookingDoctor.name.split(' ').pop()[0]}
									</div>
									<div className="flex-1">
										<h2 className="text-lg font-bold text-text-primary">Book Appointment</h2>
										<p className="text-sm text-text-secondary">{bookingDoctor.name} • {bookingDoctor.specialty} • ⭐ {bookingDoctor.rating?.toFixed(1)}</p>
									</div>
									<button onClick={() => setBookingDoctor(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-text-secondary transition-colors">✕</button>
								</div>

								<div className="px-6 py-5 space-y-5">
									{/* â”€â”€ Visit Type â”€â”€ */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-2">Visit Type</label>
										<div className="grid grid-cols-2 gap-2">
											{VISIT_TYPES.map(vt => (
												<button key={vt.value} type="button"
													className={`p-3 rounded-xl border-2 text-left transition-all ${
														bookingForm.visitType === vt.value
															? 'border-primary-500 bg-primary-50 shadow-clinical-sm'
															: 'border-gray-150 bg-white hover:border-primary-200 hover:bg-gray-50'
													}`}
													onClick={() => setBookingForm(f => ({ ...f, visitType: vt.value }))}
												>
													<div className="text-lg mb-0.5">{vt.icon}</div>
													<div className={`text-sm font-semibold ${bookingForm.visitType === vt.value ? 'text-primary-700' : 'text-text-primary'}`}>{vt.label}</div>
													<div className="text-xs text-text-secondary mt-0.5">{vt.desc}</div>
												</button>
											))}
										</div>
									</div>

									{/* â”€â”€ Date â”€â”€ */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-2">📅 Preferred Date</label>
										<input type="date" className="input w-full"
											min={TODAY}
											value={bookingForm.date}
											onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))}
										/>
									</div>

									{/* â”€â”€ Time Slots â”€â”€ */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-2">â° Available Time Slots</label>
										<div className="mb-1.5">
											<span className="text-xs text-text-secondary font-medium">Morning</span>
										</div>
										<div className="grid grid-cols-4 gap-1.5 mb-3">
											{availableSlots.filter(s => parseInt(s.start) < 12).map(slot => (
												<button key={slot.start} type="button"
													className={`py-2 px-1 rounded-lg text-xs font-medium border transition-all ${
														bookingForm.startTime === slot.start
															? 'bg-primary-600 text-white border-primary-600 shadow-sm'
															: 'bg-white text-text-secondary border-gray-200 hover:border-primary-300 hover:bg-primary-50'
													}`}
													onClick={() => setBookingForm(f => ({ ...f, startTime: slot.start, endTime: slot.end }))}
												>
													{slot.label}
												</button>
											))}
										</div>
										<div className="mb-1.5">
											<span className="text-xs text-text-secondary font-medium">Afternoon</span>
										</div>
										<div className="grid grid-cols-4 gap-1.5">
											{availableSlots.filter(s => parseInt(s.start) >= 12).map(slot => (
												<button key={slot.start} type="button"
													className={`py-2 px-1 rounded-lg text-xs font-medium border transition-all ${
														bookingForm.startTime === slot.start
															? 'bg-primary-600 text-white border-primary-600 shadow-sm'
															: 'bg-white text-text-secondary border-gray-200 hover:border-primary-300 hover:bg-primary-50'
													}`}
													onClick={() => setBookingForm(f => ({ ...f, startTime: slot.start, endTime: slot.end }))}
												>
													{slot.label}
												</button>
											))}
										</div>
									</div>

									{/* â”€â”€ Reason / Comments (Optional) â”€â”€ */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-2">📝“ Reason for Visit / Comments <span className="text-text-secondary font-normal">(optional)</span></label>
										<textarea className="input w-full resize-none" rows={2}
											placeholder="Describe your symptoms, any concerns, or additional notes..."
											value={bookingForm.reason}
											onChange={e => setBookingForm(f => ({ ...f, reason: e.target.value }))}
										/>
									</div>

									{/* â”€â”€ Upload Medical Records (Optional) â”€â”€ */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-2">📝“Ž Upload Medical Records <span className="text-text-secondary font-normal">(optional)</span></label>
										{bookingForm.uploadedFile ? (
											<div className="flex items-center gap-2 bg-success-50 border border-success-200 rounded-lg px-3 py-2">
												<span className="text-success-600">✅</span>
												<span className="text-sm text-success-700 font-medium flex-1 truncate">{bookingForm.uploadedFile.name}</span>
												<button type="button" onClick={() => setBookingForm(f => ({ ...f, uploadedFile: null }))}
													className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
											</div>
										) : (
											<label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-lg px-4 py-3 cursor-pointer transition-colors group">
												<span className="text-xl text-gray-300 group-hover:text-primary-400 transition-colors">🔄</span>
												<span className="text-sm text-text-secondary group-hover:text-primary-600">Click to upload reports, lab results, or prescriptions</span>
												<input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
													onChange={e => {
														if (e.target.files[0]) setBookingForm(f => ({ ...f, uploadedFile: e.target.files[0] }));
													}}
												/>
											</label>
										)}
									</div>

									{/* â”€â”€ Fee Summary â”€â”€ */}
									<div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100 rounded-xl p-4">
										<div className="flex items-center justify-between mb-1">
											<span className="text-sm text-text-secondary">Consultation Fee</span>
											<span className="text-xl font-bold text-primary-700">₹{bookingDoctor.consultationFee || 2000}</span>
										</div>
										<p className="text-xs text-text-secondary">Payment to be collected at the clinic or via online transfer</p>
									</div>

									{/* â”€â”€ Actions â”€â”€ */}
									<div className="flex gap-3 pt-1">
										<button onClick={() => setBookingDoctor(null)} className="btn-secondary flex-1">Cancel</button>
										<button onClick={handleFakePayment} disabled={bookingLoading || !bookingForm.visitType}
											className="btn-primary flex-1 flex items-center justify-center gap-2">
											{bookingLoading ? (
												<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Booking...</>
											) : (
												'✅ Confirm Booking'
											)}
										</button>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* â”€â”€ APPOINTMENTS TAB (Refactored with Sub-views) â”€â”€ */}
			{activeTab === 'appointments' && (
				<>
					{/* Sub-view: Consultation Preparation */}
					{subView === 'consultation-prep' && selectedAppointment && (
						<ConsultationPrep
							appointment={selectedAppointment}
							onBack={closeSubView}
						/>
					)}

					{/* Sub-view: Consultation Records */}
					{subView === 'consultation-records' && selectedAppointment && (
						<ConsultationRecords
							appointment={selectedAppointment}
							onBack={closeSubView}
						/>
					)}

					{/* Main view: Split Upcoming + Recent */}
					{!subView && (
						<div className="space-y-8 animate-fade-in">
							<div className="section-header">
								<div>
									<h1 className="text-2xl font-bold">My Appointments</h1>
									<p className="text-text-secondary text-sm mt-0.5">Manage your consultations and view records</p>
								</div>
								<button className="btn-primary btn-sm" onClick={() => handleTabChange('doctors')}>+ Book New</button>
							</div>

							{/* Upcoming Appointments */}
							<UpcomingAppointments
								appointments={appointments}
								onConsult={openConsultationPrep}
								onReschedule={(apt) => showToast(`Reschedule for ${typeof apt.doctor === 'object' ? apt.doctor.name : apt.doctor} coming soon`, 'info')}
								onCancel={(apt) => showToast(`Cancel appointment coming soon`, 'info')}
							/>

							{/* Recent Consultations */}
							<RecentConsultations
								appointments={appointments}
								onViewRecords={openConsultationRecords}
							/>
						</div>
					)}
				</>
			)}

			{/* â”€â”€ RECORDS TAB â”€â”€ */}
			{activeTab === 'records' && (
				<div className="space-y-6 animate-fade-in">
					<div className="section-header">
						<h1 className="text-2xl font-bold">Medical Records</h1>
						<button className="btn-primary btn-sm" onClick={() => setUploadModal(true)}>📤 Upload Record</button>
					</div>

					{/* Records Table */}
					<div className="card overflow-hidden p-0">
						{recordsLoading ? (
							<div className="flex items-center justify-center py-12 text-text-secondary text-sm gap-2">
								<div className="w-4 h-4 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" /> Loading records...
							</div>
						) : medicalRecords.length === 0 ? (
							<div className="text-center py-12 text-text-secondary text-sm">
								<span className="text-4xl block mb-3">📋</span>
								No records uploaded yet.
								<button onClick={() => setUploadModal(true)} className="block mx-auto mt-3 btn-primary btn-sm">Upload your first record</button>
							</div>
						) : (
							<table className="table-clinical">
								<thead><tr><th>Name</th><th>Type</th><th>Uploaded</th><th>AI Summary</th><th>Actions</th></tr></thead>
								<tbody>
									{medicalRecords.map(rec => (
										<tr key={rec.id}>
											<td className="font-medium">{rec.recordName}</td>
											<td><span className="badge badge-gray text-xs">{rec.fileType}</span></td>
																						<td className="text-xs text-text-secondary">{new Date(rec.uploadedAt).toLocaleDateString()}</td>
											<td className="max-w-[200px] text-xs text-text-secondary">
												{rec.aiSummary ? (
													<div>
														{/urgent|FLAG/i.test(rec.aiSummary) && <span className="badge-danger text-[10px] block mb-1">⚠️ See Doctor</span>}
														<p className="line-clamp-3">{rec.aiSummary.substring(0,160)}{rec.aiSummary.length>160?"...":""}</p>
													</div>
												) : <span className="italic text-[10px]">Generating...</span>}
											</td>
											<td className="space-x-2">
												<button onClick={() => setViewRecord(rec)} className="btn-ghost btn-sm text-xs">View</button>
												{rec.aiSummary && (
													<button onClick={() => downloadAiReport(rec)} className="btn-ghost btn-sm text-xs text-sky-600">📥 PDF</button>
												)}
												<button onClick={() => handleDeleteRecord(rec.id)} className="btn-ghost btn-sm text-xs text-danger-500">Delete</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>

					{/* View Record Modal */}
					{viewRecord && (
						<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewRecord(null)}>
							<div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
								<div className="p-4 border-b flex justify-between items-center bg-gray-50">
									<h3 className="font-bold text-lg">{viewRecord.recordName}</h3>
									<button onClick={() => setViewRecord(null)} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-text-secondary">✕</button>
								</div>
								<div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-6">
									<div className="border rounded-xl overflow-hidden bg-gray-100 min-h-[400px]">
										<iframe src={viewRecord.fileUrl} className="w-full h-full min-h-[400px]" title="document" />
									</div>
									<div className="space-y-4">
										<div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
											<h4 className="font-bold text-blue-800 mb-2">🧠 Full AI Clinical Summary</h4>
											<p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
												{viewRecord.aiSummary || 'No AI summary available for this record.'}
											</p>
										</div>
										<div className="text-[10px] text-gray-400 italic">
											Generated by ClinIQ BART-Large Engine · {new Date(viewRecord.uploadedAt).toLocaleDateString()}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Upload Modal */}
					{uploadModal && (
						<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setUploadModal(false)}>
							<div className="bg-white rounded-2xl shadow-clinical-lg w-full max-w-md p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
								<div className="flex items-center justify-between mb-5">
									<h2 className="text-lg font-bold text-text-primary">📤 Upload Medical Record</h2>
									<button onClick={() => setUploadModal(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-text-secondary">✕</button>
								</div>

								<div className="space-y-4">
									{/* Record Name */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-1.5">Record Name <span className="text-danger-500">*</span></label>
										<input type="text" className="input w-full"
											placeholder="e.g. Blood Test Report Jan 2025"
											value={uploadForm.recordName}
											onChange={e => setUploadForm(f => ({ ...f, recordName: e.target.value }))}
										/>
									</div>

									{/* Record Type */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-1.5">Record Type</label>
										<select className="input w-full" value={uploadForm.type}
											onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}>
											{['Lab Report', 'Prescription', 'Scan', 'Other'].map(t => <option key={t}>{t}</option>)}
										</select>
									</div>

									{/* File Upload */}
									<div>
										<label className="block text-sm font-semibold text-text-primary mb-1.5">File <span className="text-danger-500">*</span></label>
										{uploadForm.file ? (
											<div className="flex items-center gap-2 bg-success-50 border border-success-200 rounded-lg px-3 py-2">
												<span className="text-success-600">✅</span>
												<span className="text-sm text-success-700 flex-1 truncate">{uploadForm.file.name}</span>
												<button type="button" onClick={() => setUploadForm(f => ({ ...f, file: null }))}
													className="text-xs text-danger-500 hover:text-danger-700">Remove</button>
											</div>
										) : (
											<label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-xl p-6 cursor-pointer transition-colors group">
												<span className="text-3xl text-gray-300 group-hover:text-primary-400 transition-colors">🔄</span>
												<span className="text-sm text-text-secondary group-hover:text-primary-600">Click to browse</span>
												<span className="text-xs text-text-secondary">PDF, JPG, PNG –” max 5MB</span>
												<input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
													onChange={e => { if (e.target.files[0]) setUploadForm(f => ({ ...f, file: e.target.files[0] })); }} />
											</label>
										)}
									</div>

									{/* Actions */}
									<div className="flex gap-3 pt-1">
										<button onClick={() => setUploadModal(false)} className="btn-secondary flex-1">Cancel</button>
										<button onClick={handleModalUpload}
											disabled={uploading || !uploadForm.file || !uploadForm.recordName.trim()}
											className="btn-primary flex-1 flex items-center justify-center gap-2">
											{uploading ? (
												<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
											) : '✅ Upload'}
										</button>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* â”€â”€ BILLING TAB â”€â”€ */}
			{activeTab === 'billing' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">Billing & Payments</h1>
					<div className="grid sm:grid-cols-3 gap-4">
						{[
							{ label: 'Pending', value: `₹${bills.filter(b=>b.status==='pending').reduce((s,b)=>s+b.amount,0)}`, color: 'text-amber-600' },
							{ label: 'Total Paid', value: '₹12,000', color: 'text-success-600' },
							{ label: 'Total Bills', value: bills.length, color: 'text-primary-600' },
						].map((s,i) => (
							<div key={i} className="card text-center">
								<div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
								<div className="text-xs text-text-secondary mt-1">{s.label}</div>
							</div>
						))}
					</div>
					<div className="card">
						<h3 className="font-semibold mb-4">Recent Bills</h3>
						{bills.map(bill => (
							<div key={bill.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
								<div>
									<p className="text-sm font-medium">{bill.title}</p>
									<p className="text-xs text-text-secondary">{bill.date}</p>
								</div>
								<div className="flex items-center gap-3">
									<span className={`text-sm font-bold ${bill.status === 'paid' ? 'text-success-600' : 'text-amber-600'}`}>
										₹{bill.amount}
									</span>
									<span className={`badge ${bill.status === 'paid' ? 'badge-success' : 'badge-amber'}`}>
										{bill.status.toUpperCase()}
									</span>
									{bill.status === 'pending' && <button className="btn-primary btn-sm text-xs">Pay Now</button>}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* â”€â”€ PHARMACY TAB â”€â”€ */}
			{activeTab === 'pharmacy' && (
				<div className="space-y-6 animate-fade-in">
					<PharmacyStore />
				</div>
			)}

			{/* â”€â”€ AI HEALTH TAB â”€â”€ */}
			{activeTab === 'ai-health' && (
				<div className="space-y-6 animate-fade-in">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold">AI Health Assistant</h1>
						<span className="badge-ai">AI Powered</span>
					</div>
					<div className="grid lg:grid-cols-2 gap-6">
						<div className="space-y-6">
							<HealthTimeline />
							<AIHealthInsights />
						</div>
						<RAGChatbot />
					</div>
				</div>
			)}
		</AppLayout>
	);
}
