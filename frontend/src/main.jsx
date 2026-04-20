import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import DoctorDashboard from "./pages/dashboards/Doctor.jsx";
import PatientDashboard from "./pages/dashboards/Patient.jsx";
import AdminDashboard from "./pages/dashboards/Admin.jsx";
import PharmacyDashboard from "./pages/dashboards/Pharmacy.jsx";
import authService from "./services/authService.js";
import apiService from "./services/api.js";

const router = createBrowserRouter([
	{ path: "/",        element: <Home /> },
	{ path: "/login",   element: <Login /> },
	{ path: "/signup",  element: <Signup /> },
	{ path: "/doctor",  element: <DoctorDashboard /> },
	{ path: "/patient", element: <PatientDashboard /> },
	{ path: "/admin",   element: <AdminDashboard /> },
	{ path: "/pharmacy",element: <PharmacyDashboard /> }
]);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Root element not found');

authService.init();
apiService.init();

console.log('[ClinIQ AI] Initialized');

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>
);