import { useState, useRef, useEffect } from "react";
import apiService from "../services/api.js";

export default function RAGChatbot({ appointmentId = null }) {
	const [messages, setMessages]   = useState([
		{ role: "assistant", text: "👋 Hello! I'm your ClinIQ AI assistant. Ask me about your medical records, lab results, or medications.", ts: new Date().toLocaleTimeString() }
	]);
	const [input, setInput]         = useState("");
	const [loading, setLoading]     = useState(false);
	const [escalated, setEscalated] = useState(false);
	// Track last AI answer + question for escalation
	const lastAiRef = useRef({ question: "", answer: "" });
	const bottomRef = useRef(null);

	useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

	async function sendMessage() {
		const text = input.trim();
		if (!text || loading) return;

		setMessages(prev => [...prev, { role: "user", text, ts: new Date().toLocaleTimeString() }]);
		setInput("");
		setLoading(true);

		try {
			let res;
			// Use consultation-scoped chatbot if appointmentId provided
			if (appointmentId) {
				res = await apiService.askConsultationChatbot(appointmentId, text);
			} else {
				res = await apiService.askChatbot(text);
			}

			const answer     = res.data?.answer || "I couldn't generate a response.";
			const canEscalate = res.data?.canEscalate ?? true;

			// Store for escalation
			lastAiRef.current = { question: text, answer };

			setMessages(prev => [...prev, {
				role:        "assistant",
				text:        answer,
				disclaimer:  res.data?.disclaimer,
				canEscalate,
				question:    text,
				ts:          new Date().toLocaleTimeString()
			}]);
		} catch {
			setMessages(prev => [...prev, {
				role: "assistant",
				text: "⚠️ Sorry, I couldn't reach the AI service. Please try again.",
				ts:   new Date().toLocaleTimeString()
			}]);
		} finally {
			setLoading(false);
		}
	}

	async function handleEscalate(question, aiAnswer) {
		try {
			await apiService.escalateToDoctor(appointmentId, question, aiAnswer);
			setEscalated(true);
			setMessages(prev => [...prev, {
				role: "system",
				text: "📩 Your question has been sent to your doctor. They will respond shortly.",
				ts:   new Date().toLocaleTimeString()
			}]);
		} catch {
			setMessages(prev => [...prev, {
				role: "system",
				text: "❌ Could not reach doctor. For emergencies, call 112.",
				ts:   new Date().toLocaleTimeString()
			}]);
		}
	}

	return (
		<div className="card p-0 flex flex-col overflow-hidden" style={{ height: 520 }}>
			{/* Header */}
			<div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
				<div className="w-9 h-9 rounded-full bg-ai-100 flex items-center justify-center text-lg">🤖</div>
				<div className="flex-1">
					<p className="text-sm font-semibold text-text-primary">ClinIQ AI Assistant</p>
					<p className="text-[11px] text-text-secondary">AI Powered • Based on your records</p>
				</div>
				{escalated ? (
					<span className="badge-success text-[10px]">✅ Doctor Notified</span>
				) : (
					<button
						onClick={() => handleEscalate(lastAiRef.current.question, lastAiRef.current.answer)}
						className="btn-danger btn-sm text-xs"
					>
						🚨 Emergency
					</button>
				)}
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
				{messages.map((msg, i) => (
					<div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : msg.role === 'system' ? 'items-center' : 'items-start'}`}>
						{msg.role === 'assistant' && (
							<div className="max-w-[82%] bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
								<p className="text-sm text-text-primary whitespace-pre-wrap">{msg.text}</p>
								{msg.disclaimer && (
									<p className="text-[11px] text-text-secondary mt-1.5 border-t border-gray-100 pt-1">{msg.disclaimer}</p>
								)}
								<div className="flex items-center justify-between mt-1.5 gap-2">
									<span className="text-[10px] text-text-secondary">{msg.ts}</span>
									{/* Per-message escalation button */}
									{msg.canEscalate && !escalated && (
										<button
											onClick={() => handleEscalate(msg.question, msg.text)}
											className="text-[10px] text-primary-600 hover:text-primary-800 font-medium border border-primary-200 rounded-full px-2 py-0.5 hover:bg-primary-50 transition-colors"
										>
											Still confused? Ask Doctor
										</button>
									)}
								</div>
							</div>
						)}
						{msg.role === 'user' && (
							<div className="max-w-[82%] bg-primary-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5">
								<p className="text-sm">{msg.text}</p>
								<span className="text-[10px] text-primary-200 block text-right mt-1">{msg.ts}</span>
							</div>
						)}
						{msg.role === 'system' && (
							<div className="bg-primary-50 border border-primary-200 text-primary-700 rounded-clinical px-4 py-2 text-xs text-center w-full">
								{msg.text}
							</div>
						)}
					</div>
				))}
				{loading && (
					<div className="flex justify-start">
						<div className="bg-gray-50 rounded-2xl px-4 py-3 flex gap-1.5">
							<span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
							<span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
							<span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
						</div>
					</div>
				)}
				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div className="flex gap-2 p-3 border-t border-gray-100">
				<textarea
					className="input resize-none text-sm"
					rows={1}
					placeholder="Ask about your health records..."
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
					disabled={loading}
				/>
				<button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary btn-icon shrink-0">➤</button>
			</div>

			<p className="text-[10px] text-text-secondary text-center py-1.5 bg-gray-50 border-t border-gray-50">
				⚕️ AI answers are based on your records only and are not medical advice.
			</p>
		</div>
	);
}
