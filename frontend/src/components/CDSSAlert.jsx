import { useState, useEffect } from "react";
import apiService from "../services/api.js";

// Normalize fields that Ollama sometimes returns as strings instead of arrays
function normalizeResult(result) {
	if (!result) return result;
	const toArray = v => !v ? [] : Array.isArray(v) ? v : [v];
	return {
		...result,
		contraindications: toArray(result.contraindications),
		interactions:      toArray(result.interactions),
		labConcerns:       toArray(result.labConcerns),
		fdaWarnings:       toArray(result.fdaWarnings),
	};
}

// Derive the true risk level — AI's riskLevel is the primary source of truth.
// Only override to 'contraindicated' if FDA data contains hard ban keywords.
function resolveRiskLevel(result) {
	if (!result) return null;

	// Hard FDA contraindication keywords — must be explicit bans, not cautions
	const hardBanPattern = /\b(contraindicated|do not use|must not|fatal if|life.threatening|absolutely prohibited)\b/i;

	const fdaHasHardBan = result.fdaWarnings?.some(w => hardBanPattern.test(w));
	const aiSaysContraindicated = result.riskLevel === 'contraindicated';

	// Only go red if AI explicitly says contraindicated AND/OR FDA has a hard ban
	if (aiSaysContraindicated || fdaHasHardBan) return 'contraindicated';

	// Orange: AI says warning/caution, or there are interactions/FDA warnings
	if (result.riskLevel === 'warning' || result.riskLevel === 'caution') return result.riskLevel;
	if (result.interactions?.length > 0 || result.fdaWarnings?.length > 0) return 'caution';

	return 'safe';
}

const RISK_CONFIG = {
	safe:            { color: 'text-success-700', bg: 'bg-success-50',  border: 'border-success-200',  badge: 'badge-success', label: '✅ Safe',                      recBorder: 'border-l-success-400'  },
	caution:         { color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',    badge: 'badge-amber',   label: '⚠️ Careful Consideration',     recBorder: 'border-l-amber-400'    },
	warning:         { color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',    badge: 'badge-amber',   label: '⚠️ Careful Consideration',     recBorder: 'border-l-amber-400'    },
	contraindicated: { color: 'text-danger-700',  bg: 'bg-danger-50',   border: 'border-danger-200',   badge: 'badge-danger',  label: '🚫 Danger — Contraindicated',  recBorder: 'border-l-danger-400'   },
};

// Strip FDA cross-references from raw warning text
function cleanFdaText(text) {
	return text
		.replace(/\[See [^\]]+\]/gi, '')
		.replace(/\(\s*\d+(\.\d+)?\s*\)/g, '')
		.replace(/Table\s+\d+[^.;]*/gi, 'see full prescribing information')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

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
				if (!cancelled && res.success) setResult(normalizeResult(res.data));
			} catch (e) { if (!cancelled) setError("CDSS check failed: " + e.message); }
			finally { if (!cancelled) setLoading(false); }
		})();
		return () => { cancelled = true; };
	}, [medicationName, patientId]);

	if (!medicationName) return null;

	const level = resolveRiskLevel(result);
	const cfg   = level ? RISK_CONFIG[level] : null;

	return (
		<div className={`card ${cfg ? `${cfg.border} ${cfg.bg}` : ''}`}>
			<div className="flex items-center justify-between mb-3">
				<h4 className={`font-bold ${cfg ? cfg.color : 'text-text-primary'}`}>
					{loading ? "🔍 Checking drug safety…" : `🧬 CDSS: ${medicationName}`}
				</h4>
				<button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
			</div>

			{loading && (
				<div className="flex items-center gap-2 text-sm text-text-secondary">
					<div className="w-4 h-4 border-2 border-gray-200 border-t-ai-500 rounded-full animate-spin" />
					Running OpenFDA + Ollama analysis…
				</div>
			)}

			{error && <p className="text-sm text-danger-500">{error}</p>}

			{result && !loading && cfg && (
				<div className="space-y-3">
					{/* Risk badge */}
					<span className={`badge ${cfg.badge} text-sm font-bold`}>{cfg.label}</span>

					{/* Contraindications — always show if present */}
					{result.contraindications?.length > 0 && (
						<div>
							<p className="text-xs font-semibold mb-1 text-danger-700">🚫 Contraindications</p>
							<ul className="text-xs space-y-1 list-disc list-inside text-danger-800">
								{result.contraindications.map((c, i) => <li key={i}>{c}</li>)}
							</ul>
						</div>
					)}

					{/* FDA Warnings — cleaned */}
					{result.fdaWarnings?.length > 0 && (
						<div>
							<p className="text-xs font-semibold mb-1 text-text-secondary">📋 FDA Warnings</p>
							<ul className="text-xs text-text-primary space-y-1 list-disc list-inside">
								{result.fdaWarnings.map((w, i) => (
									<li key={i}>{cleanFdaText(w).substring(0, 220)}</li>
								))}
							</ul>
						</div>
					)}

					{/* Drug Interactions */}
					{result.interactions?.length > 0 && (
						<div>
							<p className="text-xs font-semibold mb-1 text-text-secondary">⚡ Drug Interactions</p>
							<ul className="text-xs text-text-primary space-y-1 list-disc list-inside">
								{result.interactions.map((x, i) => <li key={i}>{x}</li>)}
							</ul>
						</div>
					)}

					{/* Lab Concerns */}
					{result.labConcerns?.length > 0 && (
						<div>
							<p className="text-xs font-semibold mb-1 text-text-secondary">🔬 Lab Concerns</p>
							<ul className="text-xs text-text-primary space-y-1 list-disc list-inside">
								{result.labConcerns.map((c, i) => <li key={i}>{c}</li>)}
							</ul>
						</div>
					)}

					{/* Recommendation */}
					{result.recommendation && (
						<div className={`bg-white rounded-clinical p-3 text-sm text-text-primary border-l-4 ${cfg.recBorder} border border-gray-100`}>
							<strong>Recommendation:</strong> {result.recommendation}
						</div>
					)}

					<p className="text-[11px] text-text-secondary">⚕️ AI-assisted suggestion. Physician judgment takes precedence.</p>
					{result.aiNote && <p className="text-[11px] text-amber-600 mt-1">{result.aiNote}</p>}
				</div>
			)}
		</div>
	);
}
