/**
 * VerifiedBadge — shows AI-verified shield on doctor cards.
 * Uses isVerified boolean from DoctorModel.
 */
export default function VerifiedBadge({ isVerified, size = 'md' }) {
	if (!isVerified) {
		return (
			<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700">
				⏳ Pending Verification
			</span>
		);
	}

	const sizeClass = size === 'sm'
		? 'text-[10px] px-1.5 py-0.5 gap-0.5'
		: 'text-[11px] px-2 py-0.5 gap-1';

	return (
		<span className={`inline-flex items-center rounded-full font-semibold bg-success-50 border border-success-200 text-success-700 ${sizeClass}`}>
			<svg className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
			</svg>
			AI Verified
		</span>
	);
}
