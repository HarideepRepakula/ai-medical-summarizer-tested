import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout.jsx';
import apiService from '../services/api.js';
import authService from '../services/authService.js';

export default function Login() {
	const [form, setForm] = useState({ email: '', password: '' });
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!form.email || !form.password) {
			setError('Please fill in all fields');
			return;
		}
		setLoading(true);
		setError('');
		try {
			const res = await apiService.login({ identifier: form.email, password: form.password });
			if (res.accessToken) {
				authService.setAccessToken(res.accessToken);
			}
			const role = res.user?.role || 'PATIENT';
			const routes = { PATIENT: '/patient', DOCTOR: '/doctor', ADMIN: '/admin', NURSE: '/nurse', PHARMACY: '/pharmacy' };
			navigate(routes[role] || '/patient');
		} catch (err) {
			const msg = err.message || 'Login failed';
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
		<AuthLayout title="Welcome back" subtitle="Sign in to your ClinIQ AI account">
			<form onSubmit={handleSubmit} className="space-y-5 max-w-sm">
				{error && (
					<div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-clinical text-sm animate-slide-up">
						{error}
					</div>
				)}

				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">Email Address</label>
					<input
						name="email"
						type="email"
						value={form.email}
						onChange={handleChange}
						className="input"
						placeholder="you@example.com"
						autoComplete="email"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
					<input
						name="password"
						type="password"
						value={form.password}
						onChange={handleChange}
						className="input"
						placeholder="••••••••"
						autoComplete="current-password"
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					className="btn-primary w-full"
				>
					{loading ? (
						<span className="flex items-center gap-2">
							<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
							Signing in...
						</span>
					) : 'Sign In'}
				</button>

				<p className="text-sm text-text-secondary text-center">
					Don't have an account?{' '}
					<Link to="/signup" className="font-semibold text-primary-600 hover:text-primary-700">Create Account</Link>
				</p>
			</form>
		</AuthLayout>
	);
}