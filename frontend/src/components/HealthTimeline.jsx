import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import apiService from "../services/api.js";

const FLAG_COLORS = { normal: "#10B981", high: "#F59E0B", low: "#3B82F6", critical: "#EF4444", unknown: "#6B7280" };
const FLAG_ICONS = { normal: "✅", high: "⬆️", low: "⬇️", critical: "🚨", unknown: "❓" };
const CHART_COLORS = ["#2563EB", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];

export default function HealthTimeline() {
	const [timeline, setTimeline] = useState([]);
	const [labResults, setLabResults] = useState([]);
	const [selected, setSelected] = useState(null);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadMsg, setUploadMsg] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await apiService.getLabResults();
			if (res.success) {
				setTimeline(res.data.timeline || []);
				setLabResults(res.data.labResults || []);
				if (res.data.timeline?.length > 0 && !selected) setSelected(res.data.timeline[0].testName);
			}
		} catch {} finally { setLoading(false); }
	}, []);

	useEffect(() => { load(); }, [load]);

	async function handleUpload(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true); setUploadMsg("");
		try {
			const res = await apiService.uploadLabRecord(file);
			if (res.success) { setUploadMsg(`✅ ${res.message}`); await load(); }
		} catch (err) { setUploadMsg("❌ " + err.message); }
		finally { setUploading(false); e.target.value = ""; }
	}

	const selectedTimeline = timeline.find(t => t.testName === selected);
	const chartData = selectedTimeline?.series.map(s => ({ date: s.date, value: s.value, flag: s.flag })) || [];

	return (
		<div className="card">
			<div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
				<div>
					<h3 className="text-lg font-bold text-text-primary">📊 Health Timeline</h3>
					<p className="text-sm text-text-secondary">Track your lab values over time</p>
				</div>
				<label className="btn-primary btn-sm cursor-pointer">
					{uploading ? "⏳ Processing..." : "📤 Upload Lab Report"}
					<input type="file" accept="image/*,.pdf" onChange={handleUpload} disabled={uploading} hidden />
				</label>
			</div>

			{uploadMsg && (
				<div className={`mb-4 px-4 py-2 rounded-clinical text-sm ${uploadMsg.startsWith("✅") ? "bg-success-50 text-success-700 border border-success-200" : "bg-danger-50 text-danger-700 border border-danger-200"}`}>
					{uploadMsg}
				</div>
			)}

			{loading && <div className="flex items-center gap-2 py-8 text-text-secondary text-sm justify-center"><div className="w-5 h-5 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin" /> Loading...</div>}

			{!loading && timeline.length === 0 && (
				<div className="text-center py-12 text-text-secondary">
					<span className="text-4xl block mb-3">🔬</span>
					<p className="text-sm">No lab results yet. Upload a lab report to start tracking.</p>
				</div>
			)}

			{timeline.length > 0 && (
				<>
					<div className="flex flex-wrap gap-2 mb-4">
						{timeline.map((t, i) => (
							<button key={t.testName}
								onClick={() => setSelected(t.testName)}
								className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
									selected === t.testName
										? 'bg-primary-50 border-primary-500 text-primary-700'
										: 'border-gray-200 text-text-secondary hover:border-gray-300'}`}
							>{t.testName}</button>
						))}
					</div>

					{selectedTimeline && (
						<div className="bg-gray-50 rounded-clinical p-4 mb-4">
							<ResponsiveContainer width="100%" height={220}>
								<LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
									<XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} />
									<YAxis tick={{ fill: '#6B7280', fontSize: 11 }} />
									<Tooltip contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }} />
									<Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={{ r: 5, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }} />
								</LineChart>
							</ResponsiveContainer>
							<div className="flex flex-wrap gap-3 mt-3">
								{Object.entries(FLAG_COLORS).map(([flag, color]) => (
									<span key={flag} className="flex items-center gap-1.5 text-xs text-text-secondary capitalize">
										<span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{FLAG_ICONS[flag]} {flag}
									</span>
								))}
							</div>
						</div>
					)}
				</>
			)}

			<p className="text-xs text-text-secondary mt-4 border-t border-gray-100 pt-3">
				⚕️ Health data is for personal tracking only and does not constitute medical advice.
			</p>
		</div>
	);
}
