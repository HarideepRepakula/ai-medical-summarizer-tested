import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout.jsx';
import authService from '../../services/authService.js';

export default function NurseDashboard() {
	const [activeTab, setActiveTab] = useState('dashboard');
	const navigate = useNavigate();

	useEffect(() => {
		if (!authService.isAuthenticated()) { navigate('/login'); return; }
		const user = authService.getCurrentUser();
		if (!user || user.role !== 'NURSE') { navigate('/login'); return; }
	}, []);

	return (
		<AppLayout role="NURSE" activeTab={activeTab} onTabChange={setActiveTab} userName="Nurse">
			{activeTab === 'dashboard' && (
				<div className="space-y-6 animate-fade-in">
					<div><h1 className="text-2xl font-bold">Nurse Dashboard</h1><p className="text-text-secondary mt-1">Patient care overview</p></div>
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						{[
							{ label: 'Assigned Patients', value: '12', icon: '👥', color: 'text-primary-600', bg: 'bg-primary-50' },
							{ label: 'Vitals Pending', value: '5', icon: '❤️', color: 'text-danger-600', bg: 'bg-danger-50' },
							{ label: 'Tasks Today', value: '8', icon: '✅', color: 'text-success-600', bg: 'bg-success-50' },
							{ label: 'Alerts', value: '2', icon: '🔔', color: 'text-amber-600', bg: 'bg-amber-50' },
						].map((kpi, i) => (
							<div key={i} className="card-stat">
								<div className={`w-12 h-12 ${kpi.bg} rounded-clinical flex items-center justify-center text-xl shrink-0`}>{kpi.icon}</div>
								<div><div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div><div className="text-xs text-text-secondary">{kpi.label}</div></div>
							</div>
						))}
					</div>
				</div>
			)}
			{activeTab === 'patients' && <div className="space-y-6 animate-fade-in"><h1 className="text-2xl font-bold">Patients</h1><div className="card text-center py-12"><span className="text-4xl block mb-3">👥</span><p className="text-text-secondary">Patient list and care plans</p></div></div>}
			{activeTab === 'vitals' && <div className="space-y-6 animate-fade-in"><h1 className="text-2xl font-bold">Vitals Monitoring</h1><div className="card text-center py-12"><span className="text-4xl block mb-3">❤️</span><p className="text-text-secondary">Record and monitor patient vitals</p></div></div>}
			{activeTab === 'tasks' && <div className="space-y-6 animate-fade-in"><h1 className="text-2xl font-bold">Tasks</h1><div className="card text-center py-12"><span className="text-4xl block mb-3">✅</span><p className="text-text-secondary">Daily task list</p></div></div>}
		</AppLayout>
	);
}