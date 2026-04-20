export default function RecentConsultations({ appointments, onViewRecords }) {
	const completed = appointments.filter(a => a.status === 'completed');

	if (completed.length === 0) {
		return (
			<div className="card">
				<h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
					<span className="text-xl">📋</span> Recent Consultations
				</h3>
				<div className="text-center py-12">
					<span className="text-5xl block mb-3 opacity-60">📝</span>
					<p className="text-text-secondary text-sm">No completed consultations yet</p>
					<p className="text-text-secondary text-xs mt-1">Completed appointments will appear here with records</p>
				</div>
			</div>
		);
	}

	return (
		<div className="card overflow-hidden p-0">
			{/* Header */}
			<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-xl">📋</span>
					<h3 className="font-semibold text-text-primary">Recent Consultations</h3>
					<span className="badge-gray text-[10px]">{completed.length}</span>
				</div>
			</div>

			{/* Table */}
			<div className="overflow-x-auto">
				<table className="table-clinical">
					<thead>
						<tr>
							<th>Doctor</th>
							<th>Reason</th>
							<th>Date</th>
							<th>Time</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{completed.map(apt => {
							const doctorName = typeof apt.doctor === 'object' ? apt.doctor.name : apt.doctor;
							const hasRecords = apt.consultationRecords?.meetingSummary ||
								apt.consultationRecords?.meetingTranscript;

							return (
								<tr key={apt.id} className="group">
									<td>
										<div className="flex items-center gap-3">
											<div className="w-9 h-9 rounded-full bg-success-100 flex items-center justify-center text-success-700 font-bold text-sm shrink-0">
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
									<td className="text-sm whitespace-nowrap">{apt.startTime} - {apt.endTime}</td>
									<td>
										<div className="flex items-center gap-2">
											<button
												onClick={() => onViewRecords(apt)}
												className="btn-secondary btn-sm text-xs whitespace-nowrap group-hover:border-primary-300 group-hover:text-primary-700 transition-all"
											>
												📄 View Records
											</button>
											{hasRecords && (
												<span className="badge-ai text-[10px]">
													<span className="w-1.5 h-1.5 rounded-full bg-ai-500" />
													AI Records
												</span>
											)}
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
