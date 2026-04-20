import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import RAGChatbot from '../components/RAGChatbot.jsx';

export default function AppLayout({ children, role, activeTab, onTabChange, userName }) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [chatOpen, setChatOpen]       = useState(false);

	return (
		<div className="flex h-screen bg-background overflow-hidden">
			{/* Mobile overlay */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 bg-black/30 z-40 lg:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<Sidebar
				role={role}
				activeTab={activeTab}
				onTabChange={(tab) => { onTabChange(tab); setSidebarOpen(false); }}
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
			/>

			{/* Main content */}
			<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
				<Topbar
					role={role}
					userName={userName}
					onMenuClick={() => setSidebarOpen(true)}
				/>
				<main className="flex-1 overflow-y-auto p-6 lg:p-8">
					<div className="max-w-7xl mx-auto animate-fade-in">
						{children}
					</div>
				</main>
			</div>

			{/* ── Floating AI Chatbot (Patient only) ── */}
			{role === 'PATIENT' && (
				<div className="fixed bottom-6 right-6 z-50">
					{chatOpen ? (
						<div className="animate-slide-up">
							<div className="flex justify-end mb-2">
								<button
									onClick={() => setChatOpen(false)}
									className="w-7 h-7 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center hover:bg-gray-700 shadow-lg"
								>
									✕
								</button>
							</div>
							<RAGChatbot />
						</div>
					) : (
						<button
							onClick={() => setChatOpen(true)}
							className="w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-clinical-lg flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
							title="Ask AI Assistant"
						>
							🤖
						</button>
					)}
				</div>
			)}
		</div>
	);
}
