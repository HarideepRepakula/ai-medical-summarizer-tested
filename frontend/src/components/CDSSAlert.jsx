import { useState, useEffect } from "react";
import apiService from "../services/api.js";

const RISK_CONFIG = {
	safe:            { color: 'text-success-700', bg: 'bg-success-50', border: 'border-success-200', label: '✅ Safe' },
	caution:         { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: '⚠️ Caution' },
	warning:         { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: '⚠️ Warning' },
	contraindicated: { color: 'text-danger-700',  bg: 'bg-danger-50',  border: 'border-danger-200',  label: '🚫 Contraindicated' }
};

export default function CDSSAlert({ medicationName, patientId, onClose }) {
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!medicationName || !patientId) return;
		let cancelled = false;
		(async () => {
			setLoading(true); setError("");
			try {
				const res = await apiService.cdssCheck({ medicationName, patientId });
				if (!cancelled && res.success) setResult(res.data);
			} catch (e) { if (!cancelled) setError("CDSS check failed: " + e.message); }
			finally { if (!cancelled) setLoading(false); }
		})();
		return () => { cancelled = true; };
	}, [medicationName, patientId]);

	if (!medicationName) return null;
	const cfg = result ? (RISK_CONFIG[result.riskLevel] || RISK_CONFIG.caution) : null;

	return (
		<div className={`card ${cfg ? `${cfg.border} ${cfg.bg}` : ''}`}>
			<div className="flex items-center justify-between mb-3">
				<h4 className="font-bold text-text-primary">
					{loading ? "🔍 Checking drug safety…" : `🧬 CDSS: ${medicationName}`}
				</h4>
				<button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
			</div>

			{loading && (
				<div className="flex items-center gap-2 text-sm text-text-secondary">
					<div className="w-4 h-4 border-2 border-gray-200 border-t-ai-500 rounded-full animate-spin" />
					Running OpenFDA + Gemini analysis…
				</div>
			)}

			{error && <p className="text-sm text-danger-500">{error}</p>}

			{result && !loading && (
				<div className="space-y-3">
					<span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>

					{result.fdaWarnings?.length > 0 && (
						<div>
							<p className="text-xs font-semibold text-text-secondary mb-1">📋 FDA Warnings</p>
							<ul className="text-xs text-text-primary space-y-1 list-disc list-inside">
								{result.fdaWarnings.map((w, i) => <li key={i}>{w.substring(0, 200)}</li>)}
							</ul>
						</div>
					)}

					{result.interactions?.length > 0 && (
						<div>
							<p className="text-xs font-semibold text-text-secondary mb-1">⚡ Drug Interactions</p>
							<ul className="text-xs text-text-primary space-y-1 list-disc list-inside">
								{result.interactions.map((x, i) => <li key={i}>{x}</li>)}
							</ul>
						</div>
					)}

					{result.recommendation && (
						<div className="bg-white rounded-clinical p-3 text-sm text-text-primary border border-gray-100">
							<strong>Recommendation:</strong> {result.recommendation}
						</div>
					)}

					<p className="text-[11px] text-text-secondary">⚕️ AI-assisted suggestion. Physician judgment takes precedence.</p>
				</div>
			)}
		</div>
	);
}
