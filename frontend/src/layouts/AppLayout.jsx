import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout({ children, role, activeTab, onTabChange, userName }) {
	const [sidebarOpen, setSidebarOpen] = useState(false);

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
		</div>
	);
}
