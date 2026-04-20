import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout.jsx';
import authService from '../../services/authService.js';

export default function PharmacyDashboard() {
	const [activeTab, setActiveTab] = useState('dashboard');
	const navigate = useNavigate();

	useEffect(() => {
		if (!authService.isAuthenticated()) { navigate('/login'); return; }
		const user = authService.getCurrentUser();
		if (!user || user.role !== 'PHARMACY') { navigate('/login'); return; }
	}, []);

	const orders = [
		{ id: 'ORD-001', patient: 'John Doe', items: 3, total: '₹450', status: 'confirmed', date: 'Today' },
		{ id: 'ORD-002', patient: 'Jane Smith', items: 1, total: '₹125', status: 'processing', date: 'Today' },
		{ id: 'ORD-003', patient: 'Mike Johnson', items: 5, total: '₹890', status: 'ready', date: 'Yesterday' },
	];

	return (
		<AppLayout role="PHARMACY" activeTab={activeTab} onTabChange={setActiveTab} userName="Pharmacy">
			{activeTab === 'dashboard' && (
				<div className="space-y-6 animate-fade-in">
					<div><h1 className="text-2xl font-bold">Pharmacy Dashboard</h1><p className="text-text-secondary mt-1">Order management and inventory</p></div>
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						{[
							{ label: 'Pending Orders', value: '8', icon: '📦', color: 'text-amber-600', bg: 'bg-amber-50' },
							{ label: 'Ready for Pickup', value: '3', icon: '✅', color: 'text-success-600', bg: 'bg-success-50' },
							{ label: 'Low Stock Items', value: '5', icon: '⚠️', color: 'text-danger-600', bg: 'bg-danger-50' },
							{ label: 'Revenue Today', value: '₹12.5K', icon: '💰', color: 'text-primary-600', bg: 'bg-primary-50' },
						].map((kpi, i) => (
							<div key={i} className="card-stat">
								<div className={`w-12 h-12 ${kpi.bg} rounded-clinical flex items-center justify-center text-xl shrink-0`}>{kpi.icon}</div>
								<div><div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div><div className="text-xs text-text-secondary">{kpi.label}</div></div>
							</div>
						))}
					</div>

					<div className="card">
						<h3 className="font-semibold mb-4">Recent Orders</h3>
						<div className="overflow-x-auto">
							<table className="table-clinical">
								<thead><tr><th>Order ID</th><th>Patient</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
								<tbody>
									{orders.map(o => (
										<tr key={o.id}>
											<td className="font-mono text-xs">{o.id}</td>
											<td className="font-medium">{o.patient}</td>
											<td>{o.items}</td>
											<td className="font-medium">{o.total}</td>
											<td><span className={`badge ${o.status === 'ready' ? 'badge-success' : o.status === 'confirmed' ? 'badge-primary' : 'badge-amber'}`}>{o.status.toUpperCase()}</span></td>
											<td className="text-text-secondary">{o.date}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
			{activeTab === 'orders' && <div className="space-y-6 animate-fade-in"><h1 className="text-2xl font-bold">All Orders</h1><div className="card text-center py-12"><span className="text-4xl block mb-3">📦</span><p className="text-text-secondary">Full order management</p></div></div>}
			{activeTab === 'inventory' && <div className="space-y-6 animate-fade-in"><h1 className="text-2xl font-bold">Inventory</h1><div className="card text-center py-12"><span className="text-4xl block mb-3">🏪</span><p className="text-text-secondary">Stock management</p></div></div>}
			{activeTab === 'prescriptions' && <div className="space-y-6 animate-fade-in"><h1 className="text-2xl font-bold">Prescriptions</h1><div className="card text-center py-12"><span className="text-4xl block mb-3">📝</span><p className="text-text-secondary">Incoming prescriptions</p></div></div>}
		</AppLayout>
	);
}