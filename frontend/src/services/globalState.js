/**
 * GlobalStateManager — event bus only.
 * All data comes from the backend API. No mock/seed data here.
 */
class GlobalStateManager {
	constructor() {
		this.subscribers = {};
		this.state = {
			appointments:   [],
			emergencyAlerts:[],
			patients:       [],
			doctors:        [],
			nurses:         [],
			prescriptions:  [],
			medicalRecords: [],
			notifications:  [],
			aiSummaries:    {},
			wearableData:   {},
			pharmacyOrders: [],
			videoCallLinks: {},
			timeSlots:      {},
			blockedTimes:   [],
			bills:          [],
			inventory:      []
		};
	}

	subscribe(event, callback) {
		if (!this.subscribers[event]) this.subscribers[event] = [];
		this.subscribers[event].push(callback);
	}

	unsubscribe(event, callback) {
		if (this.subscribers[event]) {
			this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
		}
	}

	emit(event, data) {
		(this.subscribers[event] || []).forEach(cb => cb(data));
	}

	getState() { return this.state; }

	setState(updater) {
		this.state = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
	}

	sendNotification(userId, message, type = 'info') {
		const notification = { id: Date.now(), userId, message, type, timestamp: new Date().toISOString(), read: false };
		this.state.notifications.push(notification);
		this.emit('notificationSent', notification);
	}

	setupDashboardSync() {
		['patientDashboardUpdate','doctorDashboardUpdate','nurseDashboardUpdate','adminDashboardUpdate','pharmacyDashboardUpdate'].forEach(event => {
			this.subscribe(event, (data) => {
				window.dispatchEvent(new CustomEvent('globalStateUpdate', {
					detail: { event, data, timestamp: new Date().toISOString() }
				}));
			});
		});
	}

	initializeSystem() {
		this.setupDashboardSync();
	}
}

export const globalState = new GlobalStateManager();
globalState.initializeSystem();
