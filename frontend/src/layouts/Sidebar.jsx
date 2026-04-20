const NAV_CONFIG = {
	PATIENT: [
		{ id: 'dashboard',    label: 'Dashboard',       icon: '📊' },
		{ id: 'doctors',      label: 'Find Doctors',    icon: '🔍' },
		{ id: 'appointments', label: 'Appointments',    icon: '📅' },
		{ id: 'records',      label: 'Medical Records', icon: '📋' },
		{ id: 'billing',      label: 'Billing',         icon: '💳' },
		{ id: 'pharmacy',     label: 'Pharmacy',        icon: '💊' },
	],
	DOCTOR: [
		{ id: 'dashboard',    label: 'Dashboard',    icon: '📊' },
		{ id: 'appointments', label: 'Appointments', icon: '📅' },
		{ id: 'patients',     label: 'Patients',     icon: '👥' },
		{ id: 'schedule',     label: 'Schedule',     icon: '🗓️' },
		{ id: 'ai-tools',     label: 'AI Tools',     icon: '🧠' },
	],
	ADMIN: [
		{ id: 'dashboard',  label: 'Dashboard',  icon: '📊' },
		{ id: 'users',      label: 'Users',      icon: '👥' },
		{ id: 'analytics',  label: 'Analytics',  icon: '📈' },
		{ id: 'activity',   label: 'Activity',   icon: '📝' },
		{ id: 'settings',   label: 'Settings',   icon: '⚙️' },
	],
	NURSE: [
		{ id: 'dashboard',    label: 'Dashboard',    icon: '📊' },
		{ id: 'patients',     label: 'Patients',     icon: '👥' },
		{ id: 'vitals',       label: 'Vitals',       icon: '❤️' },
		{ id: 'tasks',        label: 'Tasks',        icon: '✅' },
	],
	PHARMACY: [
		{ id: 'dashboard',   label: 'Dashboard',   icon: '📊' },
		{ id: 'orders',      label: 'Orders',      icon: '📦' },
		{ id: 'inventory',   label: 'Inventory',   icon: '🏪' },
		{ id: 'prescriptions', label: 'Prescriptions', icon: '📝' },
	],
};

export default function Sidebar({ role, activeTab, onTabChange, isOpen, onClose }) {
	const navItems = NAV_CONFIG[role] || NAV_CONFIG.PATIENT;

	return (
		<aside className={`
			fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100
			flex flex-col transition-transform duration-300 ease-in-out
			lg:relative lg:translate-x-0
			${isOpen ? 'translate-x-0' : '-translate-x-full'}
		`}>
			{/* Logo */}
			<div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
				<div className="w-9 h-9 rounded-clinical bg-primary-600 flex items-center justify-center">
					<span className="text-white text-lg font-bold">C</span>
				</div>
				<div>
					<h1 className="text-lg font-bold text-text-primary leading-none">ClinIQ</h1>
					<span className="text-[10px] font-semibold text-ai-500 tracking-wider uppercase">AI Powered</span>
				</div>

				{/* Mobile close */}
				<button
					onClick={onClose}
					className="lg:hidden ml-auto p-1 text-gray-400 hover:text-gray-600"
					aria-label="Close sidebar"
				>
					✕
				</button>
			</div>

			{/* Navigation */}
			<nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
				{navItems.map(item => (
					<button
						key={item.id}
						onClick={() => onTabChange(item.id)}
						className={activeTab === item.id ? 'sidebar-link-active w-full' : 'sidebar-link w-full'}
					>
						<span className="text-base">{item.icon}</span>
						<span>{item.label}</span>
					</button>
				))}
			</nav>

			{/* Footer */}
			<div className="px-3 py-4 border-t border-gray-100">
				<div className="px-4 py-2 mb-2">
					<div className="badge-ai text-[10px]">
						<span className="w-1.5 h-1.5 rounded-full bg-ai-500" />
						AI Services Active
					</div>
				</div>
			</div>
		</aside>
	);
}
