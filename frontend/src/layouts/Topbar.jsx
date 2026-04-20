import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService.js';

const ROLE_LABELS = {
	PATIENT:  { label: 'Patient',   color: 'bg-success-50 text-success-700' },
	DOCTOR:   { label: 'Doctor',    color: 'bg-primary-50 text-primary-700' },
	ADMIN:    { label: 'Admin',     color: 'bg-amber-50 text-amber-700' },
	NURSE:    { label: 'Nurse',     color: 'bg-purple-50 text-purple-700' },
	PHARMACY: { label: 'Pharmacy',  color: 'bg-cyan-50 text-cyan-700' },
};

export default function Topbar({ role, userName, onMenuClick }) {
	const [showDropdown, setShowDropdown] = useState(false);
	const navigate = useNavigate();
	const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.PATIENT;

	const handleLogout = async () => {
		await authService.logout();
		navigate('/login');
	};

	return (
		<header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
			{/* Left: hamburger + page context */}
			<div className="flex items-center gap-4">
				<button
					onClick={onMenuClick}
					className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-clinical"
					aria-label="Open menu"
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>
			</div>

			{/* Right: role badge + avatar + dropdown */}
			<div className="flex items-center gap-3">
				{/* Notifications */}
				<button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-clinical transition-colors">
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
					<span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
				</button>

				{/* Role badge */}
				<span className={`badge ${roleInfo.color}`}>
					{roleInfo.label}
				</span>

				{/* Profile dropdown */}
				<div className="relative">
					<button
						onClick={() => setShowDropdown(!showDropdown)}
						className="flex items-center gap-2 p-1.5 rounded-clinical hover:bg-gray-50 transition-colors"
					>
						<div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
							<span className="text-sm font-semibold text-primary-700">
								{(userName || 'U')[0].toUpperCase()}
							</span>
						</div>
						<svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{showDropdown && (
						<>
							<div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
							<div className="absolute right-0 mt-2 w-48 bg-white rounded-clinical-lg border border-gray-100 shadow-clinical-lg z-50 animate-slide-up py-1">
								<div className="px-4 py-2 border-b border-gray-50">
									<p className="text-sm font-semibold text-text-primary">{userName || 'User'}</p>
									<p className="text-xs text-text-secondary">{roleInfo.label}</p>
								</div>
								<button className="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-gray-50 transition-colors">
									⚙️ Settings
								</button>
								<button
									onClick={handleLogout}
									className="w-full px-4 py-2 text-left text-sm text-danger-500 hover:bg-danger-50 transition-colors"
								>
									🚪 Logout
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
