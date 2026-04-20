import { useState, useRef, useEffect } from 'react';
import apiService from '../../services/api.js';

export default function ConsultationChatbot({ appointmentId, contextLabel }) {
	const [messages, setMessages] = useState([
		{
			role: 'assistant',
			text: `👋 Hello! I'm your ClinIQ AI assistant for this consultation. Ask me anything about your visit, prescription, or medical records.`,
			ts: new Date().toLocaleTimeString()
		}
	]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [escalated, setEscalated] = useState(false);
	const bottomRef = useRef(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	async function sendMessage() {
		const text = input.trim();
		if (!text || loading) return;

		setMessages(prev => [...prev, { role: 'user', text, ts: new Date().toLocaleTimeString() }]);
		setInput('');
		setLoading(true);

		try {
			const res = await apiService.askConsultationChatbot(appointmentId, text);
			setMessages(prev => [...prev, {
				role: 'assistant',
				text: res.data?.answer || "I couldn't generate a response.",
				disclaimer: res.data?.disclaimer,
				ts: new Date().toLocaleTimeString()
			}]);
		} catch {
			setMessages(prev => [...prev, {
				role: 'assistant',
				text: "⚠️ Sorry, I couldn't reach the AI service. Please try again.",
				ts: new Date().toLocaleTimeString()
			}]);
		} finally {
			setLoading(false);
		}
	}

	async function handleEscalate() {
		const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.text || '';
		try {
			await apiService.escalateToDoctor(appointmentId, lastUserMsg);
			setEscalated(true);
			setMessages(prev => [...prev, {
				role: 'system',
				text: '🚨 Your question has been flagged to the doctor for manual follow-up. They will review and respond.',
				ts: new Date().toLocaleTimeString()
			}]);
		} catch {
			setMessages(prev => [...prev, {
				role: 'system',
				text: '❌ Could not reach doctor. Call the clinic for urgent matters.',
				ts: new Date().toLocaleTimeString()
			}]);
		}
	}

	return (
		<div className="card-ai p-0 flex flex-col overflow-hidden" style={{ height: 460 }}>
			{/* Header */}
			<div className="flex items-center gap-3 px-5 py-3.5 border-b border-ai-100">
				<div className="w-9 h-9 rounded-full bg-ai-100 flex items-center justify-center text-lg">🤖</div>
				<div className="flex-1">
					<p className="text-sm font-semibold text-text-primary">Consultation AI Assistant</p>
					<p className="text-[11px] text-text-secondary">
						Gemini AI • {contextLabel || 'Based on this consultation'}
					</p>
				</div>
				{!escalated ? (
					<button onClick={handleEscalate} className="btn-danger btn-sm text-xs">
						🚨 Talk to Doctor
					</button>
				) : (
					<span className="badge-success text-[10px]">✅ Doctor Notified</span>
				)}
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
				{messages.map((msg, i) => (
					<div key={i} className={`flex ${
						msg.role === 'user' ? 'justify-end' :
						msg.role === 'system' ? 'justify-center' : 'justify-start'
					}`}>
						{msg.role === 'assistant' && (
							<div className="max-w-[80%] bg-white border border-ai-100 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
								<p className="text-sm text-text-primary whitespace-pre-wrap">{msg.text}</p>
								{msg.disclaimer && (
									<p className="text-[11px] text-text-secondary mt-1.5 border-t border-gray-100 pt-1">
										{msg.disclaimer}
									</p>
								)}
								<span className="text-[10px] text-text-secondary block text-right mt-1">{msg.ts}</span>
							</div>
						)}
						{msg.role === 'user' && (
							<div className="max-w-[80%] bg-ai-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5">
								<p className="text-sm">{msg.text}</p>
								<span className="text-[10px] text-ai-200 block text-right mt-1">{msg.ts}</span>
							</div>
						)}
						{msg.role === 'system' && (
							<div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-clinical px-4 py-2 text-xs text-center w-full">
								{msg.text}
							</div>
						)}
					</div>
				))}
				{loading && (
					<div className="flex justify-start">
						<div className="bg-white border border-ai-100 rounded-2xl px-4 py-3 flex gap-1.5">
							<span className="w-2 h-2 bg-ai-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
							<span className="w-2 h-2 bg-ai-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
							<span className="w-2 h-2 bg-ai-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
						</div>
					</div>
				)}
				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div className="flex gap-2 p-3 border-t border-ai-100">
				<textarea
					className="input resize-none text-sm"
					rows={1}
					placeholder="Ask about your consultation..."
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
					disabled={loading}
				/>
				<button
					onClick={sendMessage}
					disabled={loading || !input.trim()}
					className="btn-ai btn-icon shrink-0"
				>
					➤
				</button>
			</div>

			<p className="text-[10px] text-text-secondary text-center py-1.5 bg-ai-50/50 border-t border-ai-100">
				⚕️ AI answers are scoped to this consultation's records only.
			</p>
		</div>
	);
}
