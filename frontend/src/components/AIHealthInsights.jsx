import { useState, useEffect } from "react";
import apiService from "../services/api.js";

const URGENCY_MAP = {
	info:     { border: 'border-primary-200', bg: 'bg-primary-50', icon: '💡' },
	warning:  { border: 'border-amber-200',   bg: 'bg-amber-50',   icon: '⚠️' },
	critical: { border: 'border-danger-200',   bg: 'bg-danger-50',  icon: '🚨' }
};

export default function AIHealthInsights() {
	const [insights, setInsights] = useState([]);
	const [basedOn, setBasedOn] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		(async () => {
			setLoading(true);
			try {
				const res = await apiService.getHealthInsights();
				if (res.success) { setInsights(res.data.insights || []); setBasedOn(res.data.basedOn || ""); }
			} catch { setError("Could not load health insights."); }
			finally { setLoading(false); }
		})();
	}, []);

	if (loading) return (
		<div className="card flex items-center gap-3 text-text-secondary text-sm">
			<div className="w-5 h-5 border-2 border-gray-200 border-t-ai-500 rounded-full animate-spin" />
			Generating your personalized health insights…
		</div>
	);

	return (
		<div className="card-ai">
			<div className="flex items-start justify-between mb-4">
				<div>
					<h4 className="font-bold text-text-primary">✨ AI Health Insights</h4>
					{basedOn && <p className="text-xs text-text-secondary mt-0.5">Based on: {basedOn}</p>}
				</div>
				<span className="badge-ai text-[10px]">Gemini AI</span>
			</div>

			{error && <p className="text-sm text-danger-500 mb-3">{error}</p>}

			{insights.length === 0 && !error && (
				<p className="text-sm text-text-secondary text-center py-6">Upload a lab report to get personalized health tips.</p>
			)}

			<div className="space-y-2.5">
				{insights.map((insight, i) => {
					const style = URGENCY_MAP[insight.urgency] || URGENCY_MAP.info;
					return (
						<div key={i} className={`flex items-start gap-3 p-3 rounded-clinical border ${style.border} ${style.bg} transition-transform hover:translate-x-1`}>
							<span className="text-xl shrink-0">{insight.icon || style.icon}</span>
							<div>
								<p className="text-sm font-semibold text-text-primary">{insight.title}</p>
								<p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{insight.tip}</p>
							</div>
						</div>
					);
				})}
			</div>

			<p className="text-[11px] text-text-secondary mt-4">⚕️ AI-generated tips based on your lab data. Not a substitute for medical advice.</p>
		</div>
	);
}
