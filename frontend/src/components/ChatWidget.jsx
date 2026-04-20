import { useState } from "react";
import "./ChatWidget.css";

const ChatWidget = () => {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState([
		{ id: 1, sender: "doctor", message: "Hello! How can I help you today?", time: "10:30 AM" },
		{ id: 2, sender: "patient", message: "I have a question about my medication", time: "10:32 AM" },
		{ id: 3, sender: "doctor", message: "Of course! What medication are you taking?", time: "10:33 AM" }
	]);
	const [newMessage, setNewMessage] = useState("");

	const sendMessage = (e) => {
		e.preventDefault();
		if (!newMessage.trim()) return;
		
		const message = {
			id: messages.length + 1,
			sender: "patient",
			message: newMessage,
			time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};
		
		setMessages([...messages, message]);
		setNewMessage("");
	};

	return (
		<div className="chat-widget">
			{/* Chat Toggle Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="chat-toggle-btn"
				aria-label="Open live chat"
			>
				💬
			</button>

			{/* Chat Window */}
			{isOpen && (
				<div className="chat-window">
					{/* Chat Header */}
					<div className="chat-header">
						<div className="chat-header-content">
							<div className="doctor-info">
								<div className="doctor-avatar">
									<div className="avatar-circle">
										<span>👩‍⚕️</span>
									</div>
									<div className="online-indicator"></div>
								</div>
								<div className="doctor-details">
									<h3 className="chat-title">Live Chat</h3>
									<p className="doctor-name">Dr. Sarah Johnson</p>
								</div>
							</div>
							<button
								onClick={() => setIsOpen(false)}
								className="chat-close-btn"
								aria-label="Close chat"
							>
								✕
							</button>
						</div>
					</div>

					{/* Messages Area */}
					<div className="chat-messages">
						{messages.map(msg => (
							<div
								key={msg.id}
								className={`message-wrapper ${msg.sender === "patient" ? "outgoing" : "incoming"}`}
							>
								<div className={`message-bubble ${msg.sender === "patient" ? "patient-message" : "doctor-message"}`}>
									<p className="message-text">{msg.message}</p>
								</div>
								<div className="message-time">{msg.time}</div>
							</div>
						))}
					</div>

					{/* Input Area */}
					<form onSubmit={sendMessage} className="chat-input-form">
						<div className="input-container">
							<input
								type="text"
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								placeholder="Type your message..."
								className="chat-input"
							/>
							<button
								type="submit"
								className="send-btn"
								disabled={!newMessage.trim()}
								aria-label="Send message"
							>
								➤
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
};

export default ChatWidget;
