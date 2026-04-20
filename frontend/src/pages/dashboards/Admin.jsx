import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout.jsx';
import authService from '../../services/authService.js';

export default function AdminDashboard() {
	const [activeTab, setActiveTab] = useState('dashboard');
	const navigate = useNavigate();

	useEffect(() => {
		if (!authService.isAuthenticated()) { navigate('/login'); return; }
		const user = authService.getCurrentUser();
		if (!user || user.role !== 'ADMIN') { navigate('/login'); return; }
	}, []);

	const stats = [
		{ label: 'Total Users', value: '1,245', icon: '👥', change: '+12%', color: 'text-primary-600', bg: 'bg-primary-50' },
		{ label: 'Active Doctors', value: '48', icon: '👨‍⚕️', change: '+3', color: 'text-success-600', bg: 'bg-success-50' },
		{ label: 'Appointments Today', value: '156', icon: '📅', change: '+23%', color: 'text-amber-600', bg: 'bg-amber-50' },
		{ label: 'AI Queries', value: '892', icon: '🧠', change: '+45%', color: 'text-ai-600', bg: 'bg-ai-50' },
	];

	const recentActivity = [
		{ action: 'New user registered', user: 'patient_john@email.com', time: '2 min ago', type: 'user' },
		{ action: 'Appointment booked', user: 'Dr. Sarah Johnson', time: '5 min ago', type: 'appointment' },
		{ action: 'Lab report uploaded', user: 'patient_jane@email.com', time: '12 min ago', type: 'record' },
		{ action: 'Prescription created', user: 'Dr. Michael Chen', time: '18 min ago', type: 'prescription' },
		{ action: 'AI CDSS query', user: 'Dr. Emily Davis', time: '25 min ago', type: 'ai' },
	];

	return (
		<AppLayout role="ADMIN" activeTab={activeTab} onTabChange={setActiveTab} userName="Admin">
			{activeTab === 'dashboard' && (
				<div className="space-y-6 animate-fade-in">
					<div>
						<h1 className="text-2xl font-bold">Admin Dashboard</h1>
						<p className="text-text-secondary mt-1">System overview and monitoring</p>
					</div>

					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						{stats.map((s, i) => (
							<div key={i} className="card-stat">
								<div className={`w-12 h-12 ${s.bg} rounded-clinical flex items-center justify-center text-xl shrink-0`}>{s.icon}</div>
								<div>
									<div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
									<div className="text-xs text-text-secondary">{s.label}</div>
									<div className="text-xs text-success-600 font-medium mt-0.5">{s.change}</div>
								</div>
							</div>
						))}
					</div>

					<div className="grid lg:grid-cols-2 gap-6">
						<div className="card">
							<h3 className="font-semibold mb-4">Recent Activity</h3>
							{recentActivity.map((a, i) => (
								<div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
									<div>
										<p className="text-sm font-medium text-text-primary">{a.action}</p>
										<p className="text-xs text-text-secondary">{a.user}</p>
									</div>
									<span className="text-xs text-text-secondary">{a.time}</span>
								</div>
							))}
						</div>

						<div className="card">
							<h3 className="font-semibold mb-4">System Health</h3>
							{[
								{ name: 'API Server', status: 'Healthy', uptime: '99.9%' },
								{ name: 'MongoDB', status: 'Connected', uptime: '99.8%' },
								{ name: 'Gemini AI', status: 'Active', uptime: '98.5%' },
								{ name: 'OCR Service', status: 'Running', uptime: '99.2%' },
							].map((svc, i) => (
								<div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
									<span className="text-sm font-medium">{svc.name}</span>
									<div className="flex items-center gap-2">
										<span className="badge-success">{svc.status}</span>
										<span className="text-xs text-text-secondary">{svc.uptime}</span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{activeTab === 'users' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">User Management</h1>
					<div className="card text-center py-12">
						<span className="text-4xl block mb-3">👥</span>
						<p className="text-text-secondary">User management interface</p>
					</div>
				</div>
			)}

			{activeTab === 'analytics' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">Analytics</h1>
					<div className="card text-center py-12">
						<span className="text-4xl block mb-3">📈</span>
						<p className="text-text-secondary">Analytics dashboard with charts</p>
					</div>
				</div>
			)}

			{activeTab === 'activity' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">Activity Logs</h1>
					<div className="card text-center py-12">
						<span className="text-4xl block mb-3">📝</span>
						<p className="text-text-secondary">Detailed activity logs</p>
					</div>
				</div>
			)}

			{activeTab === 'settings' && (
				<div className="space-y-6 animate-fade-in">
					<h1 className="text-2xl font-bold">Settings</h1>
					<div className="card text-center py-12">
						<span className="text-4xl block mb-3">⚙️</span>
						<p className="text-text-secondary">System configuration</p>
					</div>
				</div>
			)}
		</AppLayout>
	);
}