export function requireRole(allowed) {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({ error: "Authentication required" });
		}
		
		const role = req.user.role;
		if (!role || !allowed.includes(role)) {
			return res.status(403).json({ error: "Forbidden" });
		}
		return next();
	};
}





