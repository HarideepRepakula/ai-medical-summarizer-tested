import { useState, useEffect } from 'react';

const STATUS_STYLES = {
	pending:     { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Pending' },
	confirmed:   { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-400', label: 'Confirmed' },
	in_progress: { bg: 'bg-primary-50', text: 'text-primary-700', dot: 'bg-primary-400', label: 'In Progress' },
};

function LiveCountdown({ appointmentDate, startTime }) {
	const [display, setDisplay] = useState('');

	useEffect(() => {
		function tick() {
			const [h, m] = startTime.split(':').map(Number);
			const apt = new Date(appointmentDate);
			apt.setHours(h, m, 0, 0);
			const diff = apt.getTime() - Date.now();
			if (diff <= 0) { setDisplay('Now'); return; }
			const hrs  = Math.floor(diff / 3600000);
			const mins = Math.floor((diff % 3600000) / 60000);
			const secs = Math.floor((diff % 60000) / 1000);
			if (hrs > 24)     setDisplay(`${Math.floor(hrs / 24)}d ${hrs % 24}h`);
			else if (hrs > 0) setDisplay(`${hrs}h ${mins}m`);
			else              setDisplay(`${mins}m ${secs}s`);
		}
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [appointmentDate, startTime]);

	const isUrgent = display.includes('m') && !display.includes('h') && !display.includes('d');

	return (
		<span className={`text-xs font-mono font-semibold ${isUrgent ? 'text-danger-500 animate-pulse-soft' : 'text-text-secondary'}`}>
			⏱ {display}
		</span>
	);
}

export default function UpcomingAppointments({ appointments, onConsult, onReschedule, onCancel }) {
	const upcoming = appointments.filter(a => ['pending', 'confirmed', 'in_progress'].includes(a.status));

	if (upcoming.length === 0) {
		return (
			<div className="card">
				<h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
					<span className="text-xl">📅</span> Upcoming Appointments
				</h3>
				<div className="text-center py-12">
					<span className="text-5xl block mb-3 opacity-60">🗓️</span>
					<p className="text-text-secondary text-sm">No upcoming appointments</p>
					<p className="text-text-secondary text-xs mt-1">Book a new appointment to get started</p>
				</div>
			</div>
		);
	}

	return (
		<div className="card overflow-hidden p-0">
			{/* Header */}
			<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-xl">📅</span>
					<h3 className="font-semibold text-text-primary">Upcoming Appointments</h3>
					<span className="badge-primary text-[10px]">{upcoming.length}</span>
				</div>
			</div>

			{/* ── Mobile Card Layout (< md) ── */}
			<div className="md:hidden divide-y divide-gray-50">
				{upcoming.map(apt => {
					const style      = STATUS_STYLES[apt.status] || STATUS_STYLES.pending;
					const doctorName = typeof apt.doctor === 'object' ? apt.doctor.name : apt.doctor;
					return (
						<div key={apt.id} className="p-4 space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shrink-0">
										{doctorName?.split(' ').pop()?.[0] || 'D'}
									</div>
									<div>
										<p className="font-semibold text-text-primary text-sm">{doctorName}</p>
										{apt.doctor?.specialty && (
											<p className="text-[11px] text-text-secondary">{apt.doctor.specialty}</p>
										)}
									</div>
								</div>
								<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}>
									<span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
									{style.label}
								</span>
							</div>

							<div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
								<div><span className="font-medium text-text-primary">📅 </span>{apt.date}</div>
								<div><span className="font-medium text-text-primary">🕐 </span>{apt.startTime} – {apt.endTime}</div>
								<div className="col-span-2"><span className="font-medium text-text-primary">📋 </span>{apt.reason}</div>
								<div className="col-span-2"><LiveCountdown appointmentDate={apt.date} startTime={apt.startTime} /></div>
							</div>

							<div className="flex gap-2">
								<button onClick={() => onConsult(apt)} className="btn-primary btn-sm text-xs flex-1">🩺 Consult</button>
								<button onClick={() => onReschedule?.(apt)} className="btn-secondary btn-sm text-xs">📅</button>
								<button onClick={() => onCancel?.(apt)} className="btn-ghost btn-sm text-xs text-danger-500">✕</button>
							</div>
						</div>
					);
				})}
			</div>

			{/* ── Desktop Table Layout (≥ md) ── */}
			<div className="hidden md:block overflow-x-auto">
				<table className="table-clinical">
					<thead>
						<tr>
							<th>Doctor</th>
							<th>Reason</th>
							<th>Date</th>
							<th>Time</th>
							<th>Countdown</th>
							<th>Status</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{upcoming.map(apt => {
							const style      = STATUS_STYLES[apt.status] || STATUS_STYLES.pending;
							const doctorName = typeof apt.doctor === 'object' ? apt.doctor.name : apt.doctor;
							return (
								<tr key={apt.id} className="group">
									<td>
										<div className="flex items-center gap-3">
											<div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
												{doctorName?.split(' ').pop()?.[0] || 'D'}
											</div>
											<div>
												<p className="font-medium text-text-primary text-sm">{doctorName}</p>
												{apt.doctor?.specialty && (
													<p className="text-[11px] text-text-secondary">{apt.doctor.specialty}</p>
												)}
											</div>
										</div>
									</td>
									<td className="text-sm max-w-[200px] truncate" title={apt.reason}>{apt.reason}</td>
									<td className="text-sm whitespace-nowrap">{apt.date}</td>
									<td className="text-sm whitespace-nowrap font-medium">{apt.startTime} - {apt.endTime}</td>
									<td><LiveCountdown appointmentDate={apt.date} startTime={apt.startTime} /></td>
									<td>
										<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
											<span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
											{style.label}
										</span>
									</td>
									<td>
										<div className="flex items-center gap-2">
											<button onClick={() => onConsult(apt)} className="btn-primary btn-sm text-xs whitespace-nowrap group-hover:shadow-clinical-md transition-shadow">
												🩺 Consult
											</button>
											<div className="relative group/actions">
												<button className="btn-ghost btn-sm text-xs px-2">⋯</button>
												<div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-clinical shadow-clinical-lg py-1 min-w-[140px] hidden group-hover/actions:block z-20">
													<button onClick={() => onReschedule?.(apt)} className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:bg-gray-50 hover:text-text-primary transition-colors">
														📅 Reschedule
													</button>
													<button onClick={() => onCancel?.(apt)} className="w-full text-left px-3 py-2 text-xs text-danger-500 hover:bg-danger-50 transition-colors">
														✕ Cancel
													</button>
												</div>
											</div>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
