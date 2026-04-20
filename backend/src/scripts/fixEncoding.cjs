const fs = require('fs');
const path = require('path');

const files = [
	'frontend/src/pages/dashboards/Doctor.jsx',
	'frontend/src/pages/dashboards/Nurse.jsx',
	'frontend/src/pages/dashboards/Admin.jsx',
	'frontend/src/pages/dashboards/Pharmacy.jsx',
	'frontend/src/pages/dashboards/Patient.jsx',
	'frontend/src/pages/Login.jsx',
	'frontend/src/pages/Home.jsx',
	'frontend/src/pages/Signup.jsx',
	'frontend/src/components/PharmacyModule.jsx',
	'frontend/src/components/AIHealthInsights.jsx',
	'frontend/src/components/appointments/UpcomingAppointments.jsx',
	'frontend/src/components/appointments/RecentConsultations.jsx',
];

const fix = (c) => c
	.replace(/â‚¹/g, '₹')
	.replace(/ðŸ"…/g, '📅')
	.replace(/ðŸ"‹/g, '📋')
	.replace(/ðŸ'³/g, '💳')
	.replace(/ðŸ§ /g, '🧠')
	.replace(/ðŸ©º/g, '🩺')
	.replace(/ðŸ"„/g, '🔄')
	.replace(/ðŸš¨/g, '🚨')
	.replace(/ðŸ"¬/g, '🔬')
	.replace(/ðŸ"Ž/g, '📎')
	.replace(/ðŸ"¤/g, '📤')
	.replace(/ðŸ'Š/g, '💊')
	.replace(/â€¢/g, '•')
	.replace(/â€"/g, '–')
	.replace(/âœ…/g, '✅')
	.replace(/âœ•/g, '✕')
	.replace(/â­/g, '⭐')
	.replace(/â°/g, '⏰')
	.replace(/ðŸ"/g, '📝')
	.replace(/ðŸ'¥/g, '👥')
	.replace(/ðŸ›¡/g, '🛡')
	.replace(/ðŸ"'/g, '🔒')
	.replace(/ðŸ—"/g, '🗓')
	.replace(/ðŸ"Š/g, '📊')
	.replace(/ðŸ©¹/g, '🩹')
	.replace(/ðŸ§ª/g, '🧪')
	.replace(/ðŸ'‰/g, '💉')
	.replace(/ðŸ¥/g, '🏥')
	.replace(/ðŸ§¬/g, '🧬')
	.replace(/ðŸ"ˆ/g, '📈')
	.replace(/ðŸ"‰/g, '📉')
	.replace(/ðŸ""/g, '🔔')
	.replace(/ðŸ'¬/g, '💬')
	.replace(/ðŸ'¤/g, '👤')
	.replace(/ðŸ"§/g, '🔧')
	.replace(/ðŸ—'ï¸/g, '🗑️')
	.replace(/â€˜/g, "'")
	.replace(/â€™/g, "'")
	.replace(/â€œ/g, '"')
	.replace(/â€/g, '"');

files.forEach(f => {
	const full = path.join('c:/Users/DELL/OneDrive/Desktop/AI Medical Record/AI-Medical-Record-Summarizer', f);
	try {
		const content = fs.readFileSync(full, 'utf8');
		fs.writeFileSync(full, fix(content), 'utf8');
		console.log('Fixed: ' + path.basename(f));
	} catch (e) {
		console.log('Skip:  ' + path.basename(f) + ' — ' + e.message);
	}
});

console.log('\nDone! All encoding issues fixed.');
