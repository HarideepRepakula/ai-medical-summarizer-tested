import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api.js';

export default function PharmacyModule() {
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [actionLoading, setActionLoading] = useState('');

	const loadOrders = useCallback(async () => {
		setLoading(true);
		try {
			const res = await apiService.getPharmacyOrders();
			setOrders(res.data?.orders || []);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { loadOrders(); }, [loadOrders]);

	async function handleDeselect(orderId, medicineIndex, currentDeselected) {
		setActionLoading(`${orderId}-${medicineIndex}`);
		try {
			await apiService.deselectMedicine(orderId, medicineIndex, !currentDeselected);
			await loadOrders();
		} catch (err) {
			setError(err.message);
		} finally {
			setActionLoading('');
		}
	}

	async function handleConfirm(orderId) {
		setActionLoading(orderId);
		try {
			await apiService.confirmPharmacyOrder(orderId, { deliveryOption: 'delivery' });
			await loadOrders();
		} catch (err) {
			setError(err.message);
		} finally {
			setActionLoading('');
		}
	}

	const STATUS_BADGE = {
		pending_patient_review: 'badge-amber',
		confirmed:   'badge-success',
		processing:  'badge-primary',
		ready:       'badge-success',
		delivered:   'badge-gray',
		cancelled:   'badge-danger'
	};

	if (loading) return (
		<div className="flex items-center justify-center py-16 text-text-secondary text-sm gap-2">
			<div className="w-5 h-5 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
			Loading pharmacy orders...
		</div>
	);

	return (
		<div className="space-y-6">
			<div className="section-header">
				<div>
					<h2 className="text-xl font-bold text-text-primary">💊 Pharmacy Orders</h2>
					<p className="text-sm text-text-secondary mt-0.5">Review and confirm your prescription cart</p>
				</div>
				<button onClick={loadOrders} className="btn-secondary btn-sm">🔄 Refresh</button>
			</div>

			{error && (
				<div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-clinical px-4 py-2 text-sm">
					{error}
				</div>
			)}

			{orders.length === 0 && !error && (
				<div className="card text-center py-12">
					<span className="text-4xl block mb-3">💊</span>
					<h3 className="font-semibold text-text-primary mb-2">No Orders Yet</h3>
					<p className="text-sm text-text-secondary">
						When a doctor prescribes medicines, your cart will appear here automatically.
					</p>
				</div>
			)}

			{orders.map(order => (
				<div key={order.id} className="card">
					<div className="flex items-start justify-between mb-4 flex-wrap gap-2">
						<div>
							<p className="text-xs text-text-secondary">Order #{String(order.id).slice(-6).toUpperCase()}</p>
							<p className="text-sm font-medium text-text-primary mt-0.5">
								Dr. {order.doctor?.name || 'Unknown'} → {order.patient?.name || 'You'}
							</p>
							<p className="text-xs text-text-secondary">{new Date(order.createdAt).toLocaleDateString()}</p>
						</div>
						<span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'}`}>
							{order.status?.replace(/_/g, ' ').toUpperCase()}
						</span>
					</div>

					<div className="space-y-2 mb-4">
						{order.medicines?.map((med, idx) => (
							<div key={idx} className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-all ${
								med.deselected ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-gray-150'
							}`}>
								<div className="flex items-center gap-3">
									{order.status === 'pending_patient_review' && (
										<button
											onClick={() => handleDeselect(order.id, idx, med.deselected)}
											disabled={!!actionLoading}
											className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
												med.deselected
													? 'border-gray-300 bg-white'
													: 'border-primary-500 bg-primary-500 text-white'
											}`}
										>
											{!med.deselected && <span className="text-[10px]">✓</span>}
										</button>
									)}
									<div>
										<p className={`text-sm font-medium ${med.deselected ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
											{med.name}
										</p>
										<p className="text-xs text-text-secondary">{med.dosage} × {med.quantity}</p>
									</div>
								</div>
								<div className="text-right">
									<p className="text-sm font-semibold text-text-primary">₹{med.lineTotal?.toFixed(2) || '0.00'}</p>
									{!med.inStock && <p className="text-[10px] text-danger-600">Out of stock</p>}
								</div>
							</div>
						))}
					</div>

					<div className="flex items-center justify-between pt-3 border-t border-gray-100">
						<div>
							<p className="text-xs text-text-secondary">Total</p>
							<p className="text-lg font-bold text-primary-700">₹{order.total?.toFixed(2) || '0.00'}</p>
						</div>
						{order.status === 'pending_patient_review' && (
							<button
								onClick={() => handleConfirm(order.id)}
								disabled={actionLoading === order.id}
								className="btn-primary btn-sm"
							>
								{actionLoading === order.id ? (
									<><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-1" />Confirming...</>
								) : '✅ Confirm Order'}
							</button>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
