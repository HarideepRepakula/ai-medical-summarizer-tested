import { Link } from 'react-router-dom';

export default function AuthLayout({ children, title, subtitle }) {
	return (
		<div className="min-h-screen flex">
			{/* Left: Illustration Panel */}
			<div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 relative overflow-hidden">
				<div className="absolute inset-0 opacity-10">
					<div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
					<div className="absolute bottom-20 right-20 w-96 h-96 bg-ai-400 rounded-full blur-3xl" />
				</div>

				<div className="relative z-10 flex flex-col justify-center px-16 text-white">
					{/* Logo */}
					<div className="flex items-center gap-3 mb-12">
						<div className="w-12 h-12 rounded-clinical-lg bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
							<span className="text-2xl font-bold">C</span>
						</div>
						<div>
							<h1 className="text-2xl font-bold leading-none">ClinIQ</h1>
							<span className="text-xs font-semibold text-primary-200 tracking-wider uppercase">AI Powered</span>
						</div>
					</div>

					<h2 className="text-4xl font-bold mb-4 leading-tight text-balance">
						The Digital<br />
						<span className="text-primary-200">Clinician</span>
					</h2>
					<p className="text-lg text-primary-100 mb-8 max-w-md leading-relaxed">
						AI-powered clinical intelligence that bridges medical data and human understanding.
					</p>

					{/* Feature pills */}
					<div className="flex flex-wrap gap-2">
						{['AI Diagnosis', 'Smart Records', 'Drug Safety', 'Health Timeline'].map(f => (
							<span key={f} className="px-3 py-1.5 bg-white/10 rounded-full text-sm font-medium backdrop-blur border border-white/10">
								{f}
							</span>
						))}
					</div>
				</div>
			</div>

			{/* Right: Form Panel */}
			<div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-20 bg-background">
				{/* Mobile logo */}
				<div className="lg:hidden flex items-center gap-2 mb-8">
					<div className="w-9 h-9 rounded-clinical bg-primary-600 flex items-center justify-center">
						<span className="text-white text-lg font-bold">C</span>
					</div>
					<span className="text-lg font-bold text-text-primary">ClinIQ AI</span>
				</div>

				{title && <h2 className="text-2xl font-bold text-text-primary mb-1">{title}</h2>}
				{subtitle && <p className="text-text-secondary mb-8">{subtitle}</p>}

				{children}
			</div>
		</div>
	);
}
