import { useState, useRef, useEffect } from "react";
import apiService from "../services/api.js";

const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function AIScribe({ appointmentId, onSaved }) {
	const [isListening, setIsListening] = useState(false);
	const [transcript, setTranscript] = useState("");
	const [interim, setInterim] = useState("");
	const [saving, setSaving] = useState(false);
	const [savedMsg, setSavedMsg] = useState("");
	const [error, setError] = useState("");
	const [duration, setDuration] = useState(0);
	const recRef = useRef(null);
	const timerRef = useRef(null);
	const segmentsRef = useRef([]);
	const supported = !!SpeechRecognition;

	useEffect(() => () => { recRef.current?.stop(); clearInterval(timerRef.current); }, []);

	function startListening() {
		if (!SpeechRecognition) return;
		setError("");
		const rec = new SpeechRecognition();
		rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
		rec.onresult = (e) => {
			let f = "", i = "";
			for (let x = e.resultIndex; x < e.results.length; x++) {
				const t = e.results[x][0].transcript;
				if (e.results[x].isFinal) { f += t + " "; segmentsRef.current.push({ speaker: "doctor", text: t.trim(), timestamp: new Date().toISOString() }); }
				else i += t;
			}
			if (f) setTranscript(p => p + f);
			setInterim(i);
		};
		rec.onerror = (e) => { setError(`Speech error: ${e.error}`); setIsListening(false); };
		rec.start(); recRef.current = rec; setIsListening(true);
		timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
	}

	function stopListening() { recRef.current?.stop(); setIsListening(false); setInterim(""); clearInterval(timerRef.current); }

	async function saveTranscript() {
		if (!transcript.trim()) return setError("No transcript to save.");
		setSaving(true); setSavedMsg("");
		try {
			await apiService.saveTranscript({ appointmentId, rawText: transcript, segments: segmentsRef.current, durationSeconds: duration });
			setSavedMsg("✅ Transcript saved."); onSaved?.({ transcript, duration });
		} catch (e) { setError("Save failed: " + e.message); } finally { setSaving(false); }
	}

	const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

	return (
		<div className="card">
			<div className="flex items-center justify-between mb-4 flex-wrap gap-3">
				<div>
					<h4 className="font-bold text-text-primary">🎙️ AI Medical Scribe</h4>
					<p className="text-xs text-text-secondary">Real-time consultation transcription</p>
				</div>
				{isListening && (
					<div className="flex items-center gap-2 px-3 py-1.5 bg-danger-50 border border-danger-200 text-danger-600 rounded-full text-xs font-semibold animate-pulse-soft">
						<span className="w-2 h-2 rounded-full bg-danger-500" />
						REC {fmt(duration)}
					</div>
				)}
			</div>

			{!supported && <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-clinical px-4 py-2 text-sm mb-3">⚠️ Speech recognition requires Chrome or Edge.</div>}
			{error && <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-clinical px-4 py-2 text-sm mb-3">{error}</div>}
			{savedMsg && <div className="bg-success-50 border border-success-200 text-success-700 rounded-clinical px-4 py-2 text-sm mb-3">{savedMsg}</div>}

			{/* Transcript */}
			<div className="bg-gray-50 border border-gray-100 rounded-clinical p-4 min-h-[120px] max-h-[220px] overflow-y-auto text-sm mb-4 whitespace-pre-wrap">
				{transcript || interim ? (
					<><span className="text-text-primary">{transcript}</span>{interim && <span className="text-text-secondary italic">{interim}</span>}</>
				) : (
					<span className="text-gray-400 italic">{isListening ? "Listening… speak now" : "Press Start to begin"}</span>
				)}
			</div>

			{/* Controls */}
			<div className="flex gap-2 flex-wrap">
				{!isListening ? (
					<button onClick={startListening} disabled={!supported} className="btn-primary btn-sm">▶ Start Recording</button>
				) : (
					<button onClick={stopListening} className="btn-danger btn-sm">⏹ Stop</button>
				)}
				<button onClick={saveTranscript} disabled={saving || !transcript.trim()} className="btn-secondary btn-sm">
					{saving ? "Saving…" : "💾 Save Transcript"}
				</button>
				<button onClick={() => { setTranscript(""); setInterim(""); segmentsRef.current = []; setDuration(0); setSavedMsg(""); setError(""); }}
					disabled={isListening} className="btn-ghost btn-sm">🗑 Clear</button>
			</div>

			<p className="text-[11px] text-text-secondary mt-3">⚕️ AI-generated transcript. Review for accuracy before use.</p>
		</div>
	);
}
