import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout.jsx';
import authService from '../services/authService.js';

const ROLES = [
	{ value: 'PATIENT',  label: 'Patient',  icon: '🩺', desc: 'Book appointments & track health' },
	{ value: 'DOCTOR',   label: 'Doctor',   icon: '👨‍⚕️', desc: 'Manage patients & consultations' },
	{ value: 'PHARMACY', label: 'Pharmacy', icon: '💊', desc: 'Manage orders & inventory' },
];

// Must exactly match DoctorModel enum
const SPECIALTIES = [
	'Cardiology', 'Dermatology', 'General Physician', 'Pediatrics',
	'Neurology', 'Orthopedics', 'Psychiatry', 'Gynecology', 'ENT', 'Ophthalmology'
];

export default function Signup() {
	const [form, setForm] = useState({
		fullName: '', email: '', phone: '', dob: '',
		password: '', confirmPassword: '', role: 'PATIENT',
		// Doctor-specific
		specialty: '', consultationFee: '', experience: '', licenseFile: null
	});
	const [error, setError]     = useState('');
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!form.fullName || !form.email || !form.phone || !form.password) {
			setError('Please fill in all required fields (Name, Email, Phone, Password)');
			return;
		}
		if (form.password.length < 8) {
			setError('Password must be at least 8 characters');
			return;
		}
		if (form.password !== form.confirmPassword) {
			setError('Passwords do not match');
			return;
		}
		if (form.role === 'DOCTOR' && !form.specialty) {
			setError('Please select your medical specialty');
			return;
		}

		setLoading(true);
		setError('');

		try {
			// Use FormData to support optional license file upload
			const fd = new FormData();
			fd.append('name',            form.fullName);
			fd.append('email',           form.email);
			fd.append('phone',           form.phone);
			fd.append('password',        form.password);
			fd.append('role',            form.role);
			if (form.dob)             fd.append('dateOfBirth',    form.dob);
			if (form.role === 'DOCTOR') {
				fd.append('specialty',       form.specialty);
				fd.append('consultationFee', form.consultationFee || '500');
				fd.append('experience',      form.experience      || '1+ years');
				if (form.licenseFile) fd.append('licenseFile', form.licenseFile);
			}

			const API_BASE = import.meta.env.VITE_API_URL || '/api';
			const response = await fetch(`${API_BASE}/auth/signup`, {
				method:      'POST',
				body:        fd,
				credentials: 'include'
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || `HTTP ${response.status}`);
			}

			if (data.accessToken) authService.setAccessToken(data.accessToken);

			const routes = { PATIENT: '/patient', DOCTOR: '/doctor', PHARMACY: '/pharmacy' };
			navigate(routes[form.role] || '/patient');

		} catch (err) {
			const msg = err.message || 'Registration failed';
			if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
				setError('❌ Cannot connect to backend. Make sure it is running on port 4000.');
			} else {
				setError(msg);
			}
		} finally {
			setLoading(false);
		}
	};

	const isDoctor = form.role === 'DOCTOR';

	return (
		<AuthLayout title="Create Account" subtitle="Join ClinIQ AI to get started">
			<form onSubmit={handleSubmit} className="space-y-5 max-w-md">
				{error && (
					<div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-clinical text-sm animate-slide-up">
						{error}
					</div>
				)}

				{/* Role selection */}
				<div>
					<label className="block text-sm font-medium text-text-primary mb-2">I am a</label>
					<div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
						{ROLES.map(r => (
							<button
								key={r.value}
								type="button"
								onClick={() => setForm({ ...form, role: r.value })}
								className={`flex flex-col items-center gap-1 p-3 rounded-clinical border text-center transition-all duration-200 ${
									form.role === r.value
										? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
										: 'border-gray-200 hover:border-gray-300 bg-white'
								}`}
							>
								<span className="text-xl">{r.icon}</span>
								<span className="text-xs font-semibold text-text-primary">{r.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Name + Phone */}
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-text-primary mb-1.5">Full Name *</label>
						<input name="fullName" value={form.fullName} onChange={handleChange}
							className="input" placeholder="John Doe" />
					</div>
					<div>
						<label className="block text-sm font-medium text-text-primary mb-1.5">Phone *</label>
						<input name="phone" value={form.phone} onChange={handleChange}
							className="input" placeholder="9876543210" />
					</div>
				</div>

				{/* Email */}
				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">Email Address *</label>
					<input name="email" type="email" value={form.email} onChange={handleChange}
						className="input" placeholder="you@example.com" />
				</div>

				{/* DOB */}
				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">Date of Birth</label>
					<input name="dob" type="date" value={form.dob} onChange={handleChange} className="input" />
				</div>

				{/* ── Doctor-specific fields ── */}
				{isDoctor && (
					<div className="space-y-4 p-4 bg-primary-50 border border-primary-100 rounded-clinical">
						<p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">👨‍⚕️ Doctor Details</p>

						{/* Specialty */}
						<div>
							<label className="block text-sm font-medium text-text-primary mb-1.5">Medical Specialty *</label>
							<select name="specialty" value={form.specialty} onChange={handleChange} className="input">
								<option value="">Select Specialty</option>
								{SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
							</select>
						</div>

						{/* Fee + Experience */}
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="block text-sm font-medium text-text-primary mb-1.5">Consultation Fee (₹)</label>
								<input name="consultationFee" type="number" min="0" value={form.consultationFee}
									onChange={handleChange} className="input" placeholder="500" />
							</div>
							<div>
								<label className="block text-sm font-medium text-text-primary mb-1.5">Experience</label>
								<input name="experience" value={form.experience} onChange={handleChange}
									className="input" placeholder="5+ years" />
							</div>
						</div>

						{/* License Upload */}
						<div>
							<label className="block text-sm font-medium text-text-primary mb-1.5">
								Medical License <span className="text-text-secondary font-normal">(optional — AI Admin will verify)</span>
							</label>
							{form.licenseFile ? (
								<div className="flex items-center gap-2 bg-success-50 border border-success-200 rounded-lg px-3 py-2">
									<span className="text-success-600">✅</span>
									<span className="text-sm text-success-700 flex-1 truncate">{form.licenseFile.name}</span>
									<button type="button" onClick={() => setForm(f => ({ ...f, licenseFile: null }))}
										className="text-xs text-danger-500 hover:text-danger-700">Remove</button>
								</div>
							) : (
								<label className="flex items-center gap-2 border-2 border-dashed border-primary-200 hover:border-primary-400 rounded-lg px-4 py-3 cursor-pointer transition-colors">
									<span className="text-xl">📄</span>
									<span className="text-sm text-text-secondary">Upload license image or PDF</span>
									<input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
										onChange={e => { if (e.target.files[0]) setForm(f => ({ ...f, licenseFile: e.target.files[0] })); }} />
								</label>
							)}
							<p className="text-[11px] text-text-secondary mt-1">
								🤖 AI Admin will automatically verify your credentials. Without a license, your account will be set to <strong>pending</strong>.
							</p>
						</div>
					</div>
				)}

				{/* Password */}
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-text-primary mb-1.5">Password *</label>
						<input name="password" type="password" value={form.password} onChange={handleChange}
							className="input" placeholder="Min 8 chars" />
					</div>
					<div>
						<label className="block text-sm font-medium text-text-primary mb-1.5">Confirm *</label>
						<input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
							className="input" placeholder="Confirm" />
					</div>
				</div>

				<button type="submit" disabled={loading} className="btn-primary w-full">
					{loading ? (
						<span className="flex items-center justify-center gap-2">
							<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							{isDoctor ? 'Registering & Verifying...' : 'Creating Account...'}
						</span>
					) : isDoctor ? '🤖 Register (AI Admin will verify)' : 'Create Account'}
				</button>

				<p className="text-sm text-text-secondary text-center">
					Already have an account?{' '}
					<Link to="/login" className="font-semibold text-primary-600">Sign In</Link>
				</p>
			</form>
		</AuthLayout>
	);
}
