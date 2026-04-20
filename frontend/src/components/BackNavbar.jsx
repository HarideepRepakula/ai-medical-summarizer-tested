import { useNavigate, Link } from "react-router-dom";
import "./BackNavbar.css";

export default function BackNavbar() {
	const navigate = useNavigate();

	return (
		<nav className="back-navbar">
			<div className="back-nav-container">
				<button 
					className="back-button" 
					onClick={() => navigate(-1)}
				>
					← Back
				</button>
				<Link to="/" className="back-nav-logo">
					<h1>MedHub</h1>
				</Link>
			</div>
		</nav>
	);
}