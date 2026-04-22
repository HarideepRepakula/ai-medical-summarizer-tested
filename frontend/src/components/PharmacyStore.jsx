import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api.js';

const CATEGORIES = ['All', 'Analgesic', 'Antibiotics', 'Antihistamine', 'Cardiovascular', 'Cholesterol', 'Diabetes', 'Gastric', 'Vitamins', 'Other'];

const CATEGORY_IMAGES = {
	Analgesic:      'https://images.unsplash.com/photo-1550572017-ed20015dd085?w=400&fit=crop',
	Antibiotics:    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&fit=crop',
	Antihistamine:  'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400&fit=crop',
	Cardiovascular: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400&fit=crop',
	Cholesterol:    'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400&fit=crop',
	Diabetes:       'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&fit=crop',
	Gastric:        'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400&fit=crop',
	Vitamins:       'https://images.unsplash.com/photo-1471864190281-ad5f9f07ce4a?w=400&fit=crop',
	Other:          'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=400&fit=crop',
	default:        'https://images.unsplash.com/photo-1550572017-ed20015dd085?w=400&fit=crop'
};

function getImage(product) {
	if (product.image && product.image.startsWith('http')) return product.image;
	return CATEGORY_IMAGES[product.category] || CATEGORY_IMAGES.default;
}

export default function PharmacyStore() {
	const [products, setProducts]             = useState([]);
	const [activeCategory, setActiveCategory] = useState('All');
	const [prescriptionCart, setPrescriptionCart] = useState(null);
	const [manualCart, setManualCart]         = useState([]);
	const [cartOpen, setCartOpen]             = useState(false);
	const [loading, setLoading]               = useState(true);
	const [actionLoading, setActionLoading]   = useState('');
	const [search, setSearch]                 = useState('');
	const [extUploading, setExtUploading]     = useState(false);
	const [reviewMeds, setReviewMeds]         = useState([]);
	const [reviewSummary, setReviewSummary]   = useState('');

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const [prodRes, orderRes] = await Promise.all([
				apiService.getPharmacyProducts(activeCategory),
				apiService.getPharmacyOrders()
			]);
			setProducts(prodRes.data?.products || []);
			const autoCart = (orderRes.data?.orders || []).find(o => o.status === 'pending_patient_review');
			if (autoCart) { setPrescriptionCart(autoCart); setCartOpen(true); }
		} catch (err) {
			console.error('Pharmacy load error:', err.message);
		} finally {
			setLoading(false);
		}
	}, [activeCategory]);

	useEffect(() => { loadData(); }, [loadData]);

	function addToCart(product) {
		setManualCart(prev => {
			const exists = prev.find(i => i._id === product._id);
			if (exists) return prev.map(i => i._id === product._id ? { ...i, qty: i.qty + 1 } : i);
			return [...prev, { ...product, qty: 1 }];
		});
		setCartOpen(true);
	}

	function removeFromCart(id) {
		setManualCart(prev => prev.filter(i => i._id !== id));
	}

	async function handleExtPrescriptionUpload(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		e.target.value = '';
		setExtUploading(true);
		setReviewMeds([]);
		try {
			const fd = new FormData();
			fd.append('file', file);
			const res = await apiService.uploadExternalPrescription(fd);
			if (res.success) {
				// Use matched inventory products (with real price/id) + unmatched names
				const matched   = (res.data.matchedProducts || []).map(p => ({ ...p, qty: 1, inInventory: true }));
				const unmatched = (res.data.unmatched || []).map(name => ({ _id: `ext-${name}`, name, price: 0, qty: 1, inInventory: false }));
				setReviewMeds([...matched, ...unmatched]);
				setReviewSummary(res.data.summary || '');
			}
		} catch (err) {
			console.error('External prescription upload failed:', err.message);
		} finally {
			setExtUploading(false);
		}
	}

	function removeReviewMed(i) {
		setReviewMeds(prev => prev.filter((_, idx) => idx !== i));
	}

	function confirmReviewMeds() {
		setManualCart(prev => {
			const toAdd = reviewMeds
				.filter(item => !prev.find(i => i._id === item._id))
				.map(item => ({ ...item, qty: item.qty || 1 }));
			return [...prev, ...toAdd];
		});
		setReviewMeds([]);
		setReviewSummary('');
		setCartOpen(true);
	}

	async function handleDeselect(orderId, idx, current) {
		setActionLoading(`${orderId}-${idx}`);
		try {
			await apiService.deselectMedicine(orderId, idx, !current);
			await loadData();
		} catch (e) { console.error(e); }
		finally { setActionLoading(''); }
	}

	async function handleConfirm() {
		if (!prescriptionCart) return;
		setActionLoading('confirm');
		try {
			await apiService.confirmPharmacyOrder(prescriptionCart.id, { deliveryOption: 'delivery' });
			setPrescriptionCart(null);
			setCartOpen(false);
			await loadData();
		} catch (e) { console.error(e); }
		finally { setActionLoading(''); }
	}

	const manualTotal      = manualCart.reduce((s, i) => s + i.price * i.qty, 0);
	const prescriptionTotal = prescriptionCart?.total || 0;
	const grandTotal       = manualTotal + prescriptionTotal;
	const totalItems       = manualCart.reduce((s, i) => s + i.qty, 0) + (prescriptionCart?.medicines?.filter(m => !m.deselected).length || 0);

	const filtered = products.filter(p =>
		!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.genericName?.toLowerCase().includes(search.toLowerCase())
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div>
					<h2 className="text-xl font-bold text-text-primary">💊 ClinIQ Medical Store</h2>
					<p className="text-sm text-text-secondary mt-0.5">Browse medicines or review your prescription cart</p>
				</div>
				<button onClick={() => setCartOpen(true)} className="btn-primary btn-sm relative">
					🛒 Cart
					{totalItems > 0 && (
						<span className="absolute -top-2 -right-2 w-5 h-5 bg-danger-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
							{totalItems}
						</span>
					)}
				</button>
			</div>

			{/* External Prescription Upload */}
			<div className="border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-clinical p-5 text-center transition-colors">
				<span className="text-3xl block mb-2">📄</span>
				<p className="text-sm font-semibold text-text-primary mb-1">Have a prescription from another doctor?</p>
				<p className="text-xs text-text-secondary mb-3">Upload it — our AI will extract the medicines for you to review before ordering.</p>
				<label className="btn-primary btn-sm cursor-pointer inline-flex items-center gap-2">
					{extUploading ? (
						<><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI reading prescription...</>
					) : '📤 Upload Prescription'}
					<input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" disabled={extUploading} onChange={handleExtPrescriptionUpload} />
				</label>
			</div>

			{/* AI Review Modal */}
			{reviewMeds.length > 0 && (
				<div className="card border border-sky-200 bg-sky-50 animate-fade-in">
					<div className="flex items-center gap-2 mb-3">
						<span className="text-lg">🤖</span>
						<h4 className="font-semibold text-sky-800 text-sm">AI Extracted These Medicines — Please Verify</h4>
					</div>
					{reviewSummary && (
						<p className="text-xs text-sky-700 bg-sky-100 rounded-clinical p-2 mb-3 leading-relaxed">{reviewSummary}</p>
					)}
					<div className="space-y-1.5 mb-4">
						{reviewMeds.map((med, i) => (
							<div key={i} className="flex items-center justify-between p-2 bg-white rounded-clinical border border-sky-100 text-sm">
								<div>
									<span className="font-medium text-text-primary">{med.name}</span>
									{med.inInventory
										? <span className="ml-2 text-xs text-success-600 font-semibold">₹{med.price} ✓ In Stock</span>
										: <span className="ml-2 text-xs text-amber-500">Not in store</span>
									}
								</div>
								<button onClick={() => removeReviewMed(i)} className="text-danger-400 hover:text-danger-600 text-xs px-2">✕ Remove</button>
							</div>
						))}
					</div>
					<div className="flex gap-2">
						<button onClick={() => { setReviewMeds([]); setReviewSummary(''); }} className="btn-ghost btn-sm flex-1 text-xs">Cancel</button>
						<button onClick={confirmReviewMeds} className="btn-primary btn-sm flex-1 text-xs">✅ Confirm & Add to Cart</button>
					</div>
				</div>
			)}

			{/* Prescription Alert Banner */}
			{prescriptionCart && (
				<div className="flex items-center justify-between gap-3 p-4 bg-primary-50 border border-primary-200 rounded-clinical animate-fade-in">
					<div className="flex items-center gap-2">
						<span className="text-xl">📋</span>
						<div>
							<p className="text-sm font-semibold text-primary-800">Prescription Cart Ready</p>
							<p className="text-xs text-primary-600">{prescriptionCart.medicines?.length} items added automatically by your doctor</p>
						</div>
					</div>
					<button onClick={() => setCartOpen(true)} className="btn-primary btn-sm text-xs whitespace-nowrap">
						Review & Pay
					</button>
				</div>
			)}

			{/* Search */}
			<input
				type="text"
				placeholder="Search medicines..."
				value={search}
				onChange={e => setSearch(e.target.value)}
				className="input max-w-sm"
			/>

			{/* Category Bar */}
			<div className="flex gap-2 flex-wrap">
				{CATEGORIES.map(cat => (
					<button
						key={cat}
						onClick={() => { setActiveCategory(cat); setSearch(''); }}
						className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
							activeCategory === cat
								? 'bg-primary-600 text-white border-primary-600'
								: 'bg-white text-text-secondary border-gray-200 hover:border-primary-300 hover:text-primary-600'
						}`}
					>
						{cat}
					</button>
				))}
			</div>

			{/* Product Grid */}
			{loading ? (
				<div className="flex items-center justify-center py-16 gap-2 text-text-secondary text-sm">
					<div className="w-5 h-5 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
					Loading products...
				</div>
			) : filtered.length === 0 ? (
				<div className="card text-center py-12">
					<span className="text-4xl block mb-3">💊</span>
					<p className="text-text-secondary text-sm">No products found.</p>
					<p className="text-text-secondary text-xs mt-1">Try a different category or run the seed script.</p>
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
					{filtered.map(p => (
						<div key={p._id} className="card p-0 overflow-hidden hover:shadow-clinical-md transition-shadow">
							<img
								src={getImage(p)}
								alt={p.name}
								className="w-full h-32 object-cover"
								onError={e => { e.target.src = CATEGORY_IMAGES.default; }}
							/>
							<div className="p-3">
								<p className="text-sm font-semibold text-text-primary leading-tight">{p.name}</p>
								<p className="text-[11px] text-text-secondary mt-0.5">{p.category}</p>
								{p.genericName && <p className="text-[11px] text-text-secondary italic">{p.genericName}</p>}
								<div className="flex items-center justify-between mt-2">
									<span className="text-sm font-bold text-primary-700">₹{p.price}</span>
									<button
										onClick={() => addToCart(p)}
										disabled={p.stock === 0}
										className="btn-primary btn-sm text-xs px-2 py-1"
									>
										{p.stock === 0 ? 'Out' : '+ Add'}
									</button>
								</div>
								{p.stock <= 10 && p.stock > 0 && (
									<p className="text-[10px] text-amber-600 mt-1">Only {p.stock} left</p>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Cart Drawer */}
			{cartOpen && (
				<div className="fixed inset-0 z-50 flex justify-end" onClick={() => setCartOpen(false)}>
					<div className="w-full max-w-sm bg-white shadow-clinical-lg flex flex-col h-full animate-slide-up" onClick={e => e.stopPropagation()}>
						{/* Cart Header */}
						<div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
							<h3 className="font-bold text-text-primary">🛒 Your Cart</h3>
							<button onClick={() => setCartOpen(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-text-secondary hover:bg-gray-200 text-sm">✕</button>
						</div>

						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{/* Prescription Section */}
							{prescriptionCart && (
								<div>
									<p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2">📋 Prescribed by Doctor</p>
									<div className="space-y-2">
										{prescriptionCart.medicines?.map((m, i) => (
											<div key={i} className={`flex items-center justify-between p-2 rounded-lg border text-sm transition-all ${m.deselected ? 'opacity-30 bg-gray-50 border-gray-100' : 'bg-primary-50 border-primary-100'}`}>
												<div className="flex items-center gap-2">
													<button
														onClick={() => handleDeselect(prescriptionCart.id, i, m.deselected)}
														disabled={!!actionLoading}
														className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${m.deselected ? 'border-gray-300 bg-white' : 'border-primary-500 bg-primary-500 text-white'}`}
													>
														{!m.deselected && <span className="text-[8px]">✓</span>}
													</button>
													<div>
														<p className={`font-medium text-xs ${m.deselected ? 'line-through text-text-secondary' : 'text-text-primary'}`}>{m.name}</p>
														<p className="text-[10px] text-text-secondary">{m.dosage} × {m.quantity}</p>
													</div>
												</div>
												<span className="text-xs font-semibold text-primary-700">₹{m.lineTotal}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Manual Cart Section */}
							{manualCart.length > 0 && (
								<div>
									<p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">🛍️ Manual Items</p>
									<div className="space-y-2">
										{manualCart.map(item => (
											<div key={item._id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-white text-sm">
												<div>
													<p className="font-medium text-xs text-text-primary">{item.name}</p>
													<p className="text-[10px] text-text-secondary">Qty: {item.qty}</p>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-xs font-semibold">₹{item.price * item.qty}</span>
													<button onClick={() => removeFromCart(item._id)} className="text-danger-400 hover:text-danger-600 text-xs">✕</button>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{totalItems === 0 && (
								<div className="text-center py-8 text-text-secondary text-sm">
									<span className="text-3xl block mb-2">🛒</span>
									Your cart is empty
								</div>
							)}
						</div>

						{/* Cart Footer */}
						{totalItems > 0 && (
							<div className="border-t border-gray-100 p-4 space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-text-secondary">Grand Total</span>
									<span className="text-lg font-bold text-primary-700">₹{grandTotal.toFixed(2)}</span>
								</div>
								{prescriptionCart && (
									<button
										onClick={handleConfirm}
										disabled={actionLoading === 'confirm'}
										className="btn-primary w-full flex items-center justify-center gap-2"
									>
										{actionLoading === 'confirm' ? (
											<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Confirming...</>
										) : '✅ Confirm & Deliver'}
									</button>
								)}
								{manualCart.length > 0 && !prescriptionCart && (
									<button className="btn-primary w-full">✅ Place Order</button>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
