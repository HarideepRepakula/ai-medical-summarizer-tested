import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout.jsx';
import apiService from '../services/api.js';
import authService from '../services/authService.js';

const ROLES = [
	{ value: 'PATIENT',  label: 'Patient',  icon: '🩺', desc: 'Book appointments & track health' },
	{ value: 'DOCTOR',   label: 'Doctor',   icon: '👨‍⚕️', desc: 'Manage patients & consultations' },
	{ value: 'NURSE',    label: 'Nurse',    icon: '👩‍⚕️', desc: 'Clinical support & vitals' },
	{ value: 'ADMIN',    label: 'Admin',    icon: '🛡️', desc: 'System administration' },
	{ value: 'PHARMACY', label: 'Pharmacy', icon: '💊', desc: 'Manage orders & inventory' },
];

export default function Signup() {
	const [form, setForm] = useState({
		fullName: '', email: '', phone: '', dob: '',
		password: '', confirmPassword: '', role: 'PATIENT'
	});
	const [error, setError] = useState('');
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
		setLoading(true);
		setError('');
		try {
			const res = await apiService.signup({
				name: form.fullName, email: form.email, phone: form.phone,
				dateOfBirth: form.dob, password: form.password, role: form.role
			});
			if (res.accessToken) authService.setAccessToken(res.accessToken);
			const routes = { PATIENT: '/patient', DOCTOR: '/doctor', ADMIN: '/admin', NURSE: '/nurse', PHARMACY: '/pharmacy' };
			navigate(routes[form.role] || '/patient');
		} catch (err) {
			const msg = err.message || 'Registration failed';
			if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
				setError('❌ Cannot connect to backend server. Make sure the backend is running on port 4000.');
			} else {
				setError(msg);
			}
		} finally {
			setLoading(false);
		}
	};

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
						<label className="block text-sm font-medium text-text-primary mb-1.5">Phone</label>
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
						<span className="flex items-center gap-2">
							<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
							Creating Account...
						</span>
					) : 'Create Account'}
				</button>

				<p className="text-sm text-text-secondary text-center">
					Already have an account?{' '}
					<Link to="/login" className="font-semibold text-primary-600">Sign In</Link>
				</p>
			</form>
		</AuthLayout>
	);
}