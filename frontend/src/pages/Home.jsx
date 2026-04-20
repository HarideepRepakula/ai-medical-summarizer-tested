import { Link } from 'react-router-dom';

export default function Home() {
	return (
		<div className="min-h-screen bg-background">
			{/* Navbar */}
			<nav className="bg-white border-b border-gray-100 px-6 lg:px-16 py-4 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="w-9 h-9 rounded-clinical bg-primary-600 flex items-center justify-center">
						<span className="text-white text-lg font-bold">C</span>
					</div>
					<span className="text-xl font-bold text-text-primary">ClinIQ <span className="text-ai-500 text-sm font-semibold">AI</span></span>
				</div>
				<div className="flex items-center gap-3">
					<Link to="/login" className="btn-ghost btn-sm">Login</Link>
					<Link to="/signup" className="btn-primary btn-sm">Get Started</Link>
				</div>
			</nav>

			{/* Hero */}
			<section className="px-6 lg:px-16 py-20 lg:py-28">
				<div className="max-w-6xl mx-auto text-center">
					<div className="badge-ai mb-6 mx-auto">✨ AI-Powered Clinical Intelligence</div>
					<h1 className="text-4xl lg:text-6xl font-extrabold text-text-primary mb-6 leading-tight text-balance">
						Your Health, <br className="hidden sm:block" />
						<span className="text-primary-600">Intelligently</span> Managed
					</h1>
					<p className="text-lg lg:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
						Connect with healthcare professionals, get AI-powered health insights,
						and manage your clinical journey — all in one platform.
					</p>
					<div className="flex items-center justify-center gap-4 flex-wrap">
						<Link to="/signup" className="btn-primary btn-lg">
							Start Free →
						</Link>
						<Link to="/login" className="btn-secondary btn-lg">
							Sign In
						</Link>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="px-6 lg:px-16 pb-20">
				<div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
					{[
						{
							icon: '🧠', title: 'AI Health Insights',
							desc: 'Get personalized health analysis powered by Gemini AI, from lab reports to drug safety checks.',
							badge: 'AI Assisted'
						},
						{
							icon: '📋', title: 'Smart Records',
							desc: 'Upload lab reports and get instant OCR parsing with structured data visualization and trend tracking.',
							badge: null
						},
						{
							icon: '💊', title: 'Pharmacy Automation',
							desc: 'Auto-generated medicine carts from prescriptions, with real-time order tracking and inventory matching.',
							badge: null
						},
						{
							icon: '🎙️', title: 'AI Medical Scribe',
							desc: 'Real-time voice transcription during consultations using Web Speech API — no cost, no setup.',
							badge: 'AI Assisted'
						},
						{
							icon: '🛡️', title: 'Drug Safety (CDSS)',
							desc: 'Clinical decision support with OpenFDA integration and Gemini analysis for drug interactions.',
							badge: 'AI Assisted'
						},
						{
							icon: '📊', title: 'Health Timeline',
							desc: 'Track lab values over time with interactive charts, color-coded flags, and trend analysis.',
							badge: null
						},
					].map((f, i) => (
						<div key={i} className={`card hover:shadow-clinical-md transition-shadow duration-300 ${f.badge ? 'border-ai-100' : ''}`}>
							<span className="text-3xl mb-4 block">{f.icon}</span>
							<div className="flex items-center gap-2 mb-2">
								<h3 className="text-lg font-bold text-text-primary">{f.title}</h3>
								{f.badge && <span className="badge-ai text-[10px]">{f.badge}</span>}
							</div>
							<p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
						</div>
					))}
				</div>
			</section>

			{/* CTA */}
			<section className="px-6 lg:px-16 pb-20">
				<div className="max-w-4xl mx-auto bg-gradient-to-r from-primary-600 to-primary-800 rounded-clinical-lg p-10 lg:p-14 text-center text-white relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
					</div>
					<div className="relative z-10">
						<h2 className="text-2xl lg:text-3xl font-bold mb-4">Ready to experience intelligent healthcare?</h2>
						<p className="text-primary-100 mb-8 max-w-lg mx-auto">Join ClinIQ AI and access the future of clinical intelligence — for free.</p>
						<Link to="/signup" className="inline-flex items-center gap-2 bg-white text-primary-700 px-8 py-3 rounded-clinical font-semibold hover:bg-primary-50 transition-colors">
							Create Account →
						</Link>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-gray-100 px-6 lg:px-16 py-8">
				<div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-text-secondary">
					<div className="flex items-center gap-2">
						<span className="font-semibold text-text-primary">ClinIQ AI</span>
						<span>• Clinical Intelligence Assistant</span>
					</div>
					<span>© 2026 ClinIQ AI. All rights reserved.</span>
				</div>
			</footer>
		</div>
	);
}