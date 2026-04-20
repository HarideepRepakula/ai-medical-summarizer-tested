import authService from './authService.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

class ApiService {
	// ── Core request method with automatic token refresh ──────────────────────
	async request(endpoint, options = {}) {
		const url = `${API_BASE_URL}${endpoint}`;

		if (authService.isAuthenticated()) {
			const response = await authService.authenticatedFetch(url, options);
			const data = await response.text();
			if (!response.ok) {
				let msg = `HTTP ${response.status}`;
				try { msg = JSON.parse(data).error || msg; } catch {}
				throw new Error(msg);
			}
			return data ? JSON.parse(data) : {};
		}

		// Public endpoints
		const config = {
			headers: { 'Content-Type': 'application/json', ...options.headers },
			credentials: 'include',
			...options,
		};

		try {
			const response = await fetch(url, config);
			const data     = await response.text();
			if (!response.ok) {
				let msg = `HTTP ${response.status}`;
				try { msg = JSON.parse(data).error || msg; } catch {}
				throw new Error(msg);
			}
			return data ? JSON.parse(data) : {};
		} catch (error) {
			console.error('API request failed:', error);
			throw error;
		}
	}

	// Multipart request (for file uploads)
	async requestMultipart(endpoint, formData) {
		const url = `${API_BASE_URL}${endpoint}`;
		if (!authService.isAuthenticated()) {
			throw new Error('Authentication required');
		}
		const response = await authService.authenticatedFetch(url, {
			method: 'POST',
			body:   formData,
			// Let the browser set Content-Type with boundary for multipart
			headers: {} // Override default JSON header
		});
		const data = await response.text();
		if (!response.ok) {
			let msg = `HTTP ${response.status}`;
			try { msg = JSON.parse(data).error || msg; } catch {}
			throw new Error(msg);
		}
		return data ? JSON.parse(data) : {};
	}

	// ── Auth ──────────────────────────────────────────────────────────────────
	async login(credentials)  { return authService.login(credentials); }
	async signup(userData)    {
		return this.request('/auth/signup', { method: 'POST', body: JSON.stringify(userData) });
	}
	async logout()            { return authService.logout(); }
	async logoutAllDevices()  { return authService.logoutAllDevices(); }
	async refreshToken()      { return authService.refreshAccessToken(); }
	async getCurrentUser()    { return this.request('/auth/me'); }
	async getActiveSessions() { return this.request('/auth/sessions'); }

	// ── Doctors ───────────────────────────────────────────────────────────────
	async getDoctors(specialty = '') {
		const q = specialty ? `?specialty=${encodeURIComponent(specialty)}` : '';
		return this.request(`/doctors${q}`);
	}
	async getDoctorById(id) { return this.request(`/doctors/${id}`); }

	// ── Appointments ──────────────────────────────────────────────────────────
	async getAppointments(params = {}) {
		const q = new URLSearchParams(params).toString();
		return this.request(`/appointments${q ? `?${q}` : ''}`);
	}
	async bookAppointment(data) {
		return this.request('/appointments/book', { method: 'POST', body: JSON.stringify(data) });
	}
	async updateAppointment(id, data) {
		return this.request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
	}
	async cancelAppointment(id, data = {}) {
		return this.request(`/appointments/${id}/cancel`, { method: 'DELETE', body: JSON.stringify(data) });
	}
	async rescheduleAppointment(id, data) {
		return this.request(`/appointments/${id}/reschedule`, { method: 'POST', body: JSON.stringify(data) });
	}
	async getAppointmentLockState(id) {
		return this.request(`/appointments/${id}/lock-state`);
	}
	async getDoctorAvailability(doctorId, date) {
		return this.request(`/appointments/availability?doctorId=${doctorId}&date=${date}`);
	}

	// ── Schedule ──────────────────────────────────────────────────────────────
	async getSchedule(date) {
		return this.request(`/schedule${date ? `?date=${date}` : ''}`);
	}
	async addTimeSlot(slotData) {
		return this.request('/schedule/add-slot', { method: 'POST', body: JSON.stringify(slotData) });
	}
	async blockTime(blockData) {
		return this.request('/schedule/block-time', { method: 'POST', body: JSON.stringify(blockData) });
	}

	// ── Records / OCR ─────────────────────────────────────────────────────────
	async uploadLabRecord(file) {
		const fd = new FormData();
		fd.append('file', file);
		// Override authenticatedFetch — multer needs raw FormData
		const url      = `${API_BASE_URL}/records/upload`;
		const token    = authService.getAccessToken();
		const response = await fetch(url, {
			method:      'POST',
			headers:     token ? { Authorization: `Bearer ${token}` } : {},
			credentials: 'include',
			body:        fd
		});
		const data = await response.text();
		if (!response.ok) {
			let msg = `HTTP ${response.status}`;
			try { msg = JSON.parse(data).error || msg; } catch {}
			throw new Error(msg);
		}
		return data ? JSON.parse(data) : {};
	}
	async getLabResults() { return this.request('/records/lab-results'); }

	// ── Medical Records ───────────────────────────────────────────────────────
	async getMedicalRecords() { return this.request('/medical-records'); }
	async uploadMedicalRecord(file, recordName, type) {
		const fd = new FormData();
		fd.append('file', file);
		fd.append('recordName', recordName);
		fd.append('type', type);
		const url      = `${API_BASE_URL}/medical-records/upload`;
		const token    = authService.getAccessToken();
		const response = await fetch(url, {
			method:      'POST',
			headers:     token ? { Authorization: `Bearer ${token}` } : {},
			credentials: 'include',
			body:        fd,
		});
		const data = await response.text();
		if (!response.ok) {
			let msg = `HTTP ${response.status}`;
			try { msg = JSON.parse(data).error || msg; } catch {}
			throw new Error(msg);
		}
		return data ? JSON.parse(data) : {};
	}
	async deleteMedicalRecord(id) { return this.request(`/medical-records/${id}`, { method: 'DELETE' }); }

	// ── AI Features ───────────────────────────────────────────────────────────
	async getPreConsultSummary(appointmentId) {
		return this.request(`/ai/pre-consult-summary/${appointmentId}`);
	}
	async saveTranscript(data) {
		return this.request('/ai/save-transcript', { method: 'POST', body: JSON.stringify(data) });
	}
	async cdssCheck(data) {
		return this.request('/ai/cdss-check', { method: 'POST', body: JSON.stringify(data) });
	}
	async getHealthInsights() { return this.request('/ai/health-insights'); }

	// ── Pharmacy ──────────────────────────────────────────────────────────────
	async getPharmacyOrders() { return this.request('/pharmacy/orders'); }
	async createAutoCart(prescriptionId) {
		return this.request('/pharmacy/auto-cart', { method: 'POST', body: JSON.stringify({ prescriptionId }) });
	}
	async deselectMedicine(orderId, medicineIndex, deselected) {
		return this.request(`/pharmacy/orders/${orderId}/deselect`, {
			method: 'PATCH',
			body:   JSON.stringify({ medicineIndex, deselected })
		});
	}
	async confirmPharmacyOrder(orderId, data = {}) {
		return this.request(`/pharmacy/orders/${orderId}/confirm`, {
			method: 'PATCH',
			body:   JSON.stringify(data)
		});
	}
	async updateOrderStatus(orderId, status) {
		return this.request(`/pharmacy/orders/${orderId}/status`, {
			method: 'PATCH',
			body:   JSON.stringify({ status })
		});
	}

	// ── Prescriptions ─────────────────────────────────────────────────────────
	async createPrescription(data) {
		return this.request('/prescriptions', { method: 'POST', body: JSON.stringify(data) });
	}
	async getPrescriptions() { return this.request('/prescriptions'); }

	// ── Chatbot ───────────────────────────────────────────────────────────────
	async askChatbot(message) {
		return this.request('/chatbot/ask', { method: 'POST', body: JSON.stringify({ message }) });
	}
	async escalateToDoctor(appointmentId = null, question = '') {
		return this.request('/chatbot/escalate', {
			method: 'POST',
			body:   JSON.stringify({ appointmentId, question })
		});
	}
	async askConsultationChatbot(appointmentId, message) {
		return this.request('/chatbot/ask-consultation', {
			method: 'POST',
			body:   JSON.stringify({ appointmentId, message })
		});
	}

	// ── Consultation Lifecycle ─────────────────────────────────────────────
	async getAiSummary(appointmentId) {
		return this.request(`/appointments/${appointmentId}/ai-summary`);
	}
	async updateAiSummary(appointmentId, data) {
		return this.request(`/appointments/${appointmentId}/ai-summary`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
	}
	async uploadConsultationRecord(appointmentId, file) {
		const fd = new FormData();
		fd.append('file', file);
		const url      = `${API_BASE_URL}/appointments/${appointmentId}/upload-record`;
		const token    = authService.getAccessToken();
		const response = await fetch(url, {
			method:      'POST',
			headers:     token ? { Authorization: `Bearer ${token}` } : {},
			credentials: 'include',
			body:        fd
		});
		const data = await response.text();
		if (!response.ok) {
			let msg = `HTTP ${response.status}`;
			try { msg = JSON.parse(data).error || msg; } catch {}
			throw new Error(msg);
		}
		return data ? JSON.parse(data) : {};
	}
	async completeConsultation(appointmentId, data = {}) {
		return this.request(`/appointments/${appointmentId}/complete`, {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}
	async getConsultationRecords(appointmentId) {
		return this.request(`/appointments/${appointmentId}/records`);
	}

	// ── Patient Queries (Doctor responds to escalated chatbot queries) ──────────
	async getPatientQueries(appointmentId) {
		return this.request(`/appointments/${appointmentId}/patient-queries`);
	}
	async respondToPatientQuery(appointmentId, queryId, response) {
		return this.request(`/appointments/${appointmentId}/patient-queries/${queryId}/respond`, {
			method: 'POST',
			body: JSON.stringify({ response })
		});
	}

	// ── Notifications ─────────────────────────────────────────────────────────
	async getNotifications() { return this.request('/notifications'); }
	async markNotificationsRead(ids) {
		return this.request('/notifications/read', { method: 'PATCH', body: JSON.stringify({ ids }) });
	}

	// ── Network monitoring ────────────────────────────────────────────────────
	setupNetworkMonitoring() {
		window.addEventListener('online',  () => console.log('[API] Connection restored'));
		window.addEventListener('offline', () => console.log('[API] Connection lost'));
	}

	init() { this.setupNetworkMonitoring(); }
}

export default new ApiService();