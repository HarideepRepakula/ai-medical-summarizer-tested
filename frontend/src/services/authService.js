class AuthService {
	constructor() {
		this.accessToken = null; // Store in memory only
		this.refreshPromise = null; // Prevent multiple refresh calls
		this.isRefreshing = false;
		this.failedQueue = [];
	}

	// Store access token in memory only (never localStorage)
	setAccessToken(token) {
		this.accessToken = token;
	}

	// Get access token from memory
	getAccessToken() {
		return this.accessToken;
	}

	// Clear access token from memory
	clearAccessToken() {
		this.accessToken = null;
	}

	// Check if user is authenticated (has valid access token)
	isAuthenticated() {
		return !!this.accessToken;
	}

	// Get current user from token (decode JWT payload)
	getCurrentUser() {
		if (!this.accessToken) return null;
		
		try {
			// Decode JWT payload (base64 decode the middle part)
			const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
			return {
				userId: payload.userId,
				role: payload.role,
				email: payload.email,
				exp: payload.exp
			};
		} catch (error) {
			console.error('Failed to decode access token:', error);
			return null;
		}
	}

	// Check if access token is expired
	isTokenExpired() {
		const user = this.getCurrentUser();
		if (!user) return true;
		
		// Check if token expires in next 30 seconds (proactive refresh)
		const expirationTime = user.exp * 1000;
		const currentTime = Date.now();
		const bufferTime = 30 * 1000; // 30 seconds buffer
		
		return currentTime >= (expirationTime - bufferTime);
	}

	// Refresh access token using refresh token (httpOnly cookie)
	async refreshAccessToken() {
		// Prevent multiple simultaneous refresh calls
		if (this.isRefreshing) {
			return new Promise((resolve, reject) => {
				this.failedQueue.push({ resolve, reject });
			});
		}

		this.isRefreshing = true;

		try {
			console.log('[AUTH] Refreshing access token...');
			
			const response = await fetch('/api/auth/refresh', {
				method: 'POST',
				credentials: 'include', // Include httpOnly cookies
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Token refresh failed');
			}

			const data = await response.json();
			this.setAccessToken(data.accessToken);
			
			console.log('[AUTH] Access token refreshed successfully');
			
			// Process failed queue
			this.failedQueue.forEach(({ resolve }) => resolve(data.accessToken));
			this.failedQueue = [];
			
			return data.accessToken;
			
		} catch (error) {
			console.error('[AUTH] Token refresh failed:', error.message);
			
			// Clear tokens and redirect to login
			this.clearAccessToken();
			
			// Process failed queue with error
			this.failedQueue.forEach(({ reject }) => reject(error));
			this.failedQueue = [];
			
			// Broadcast logout event to all tabs
			this.broadcastLogout();
			
			throw error;
		} finally {
			this.isRefreshing = false;
		}
	}

	// Login with credentials
	async login(credentials) {
		try {
			console.log('[AUTH] Attempting login...');
			
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include', // Include cookies
				body: JSON.stringify(credentials)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Login failed');
			}

			const data = await response.json();
			this.setAccessToken(data.accessToken);
			
			console.log('[AUTH] Login successful');
			
			// Broadcast login event to other tabs
			this.broadcastLogin(data.user);
			
			return data;
			
		} catch (error) {
			console.error('[AUTH] Login failed:', error.message);
			throw error;
		}
	}

	// Logout (revoke refresh token)
	async logout() {
		try {
			console.log('[AUTH] Logging out...');
			
			// Call logout endpoint to revoke refresh token
			await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});
			
		} catch (error) {
			console.error('[AUTH] Logout API call failed:', error);
			// Continue with local cleanup even if API call fails
		} finally {
			// Always clear local state
			this.clearAccessToken();
			
			// Broadcast logout to other tabs
			this.broadcastLogout();
			
			console.log('[AUTH] Logout completed');
		}
	}

	// Logout from all devices
	async logoutAllDevices() {
		try {
			const response = await this.authenticatedFetch('/api/auth/logout-all', {
				method: 'POST'
			});
			
			if (!response.ok) {
				throw new Error('Failed to logout from all devices');
			}
			
			// Clear local state
			this.clearAccessToken();
			this.broadcastLogout();
			
			return await response.json();
			
		} catch (error) {
			console.error('[AUTH] Logout all devices failed:', error);
			throw error;
		}
	}

	// Enhanced fetch with automatic token refresh
	async authenticatedFetch(url, options = {}) {
		// Check if token needs refresh before making request
		if (this.isTokenExpired()) {
			try {
				await this.refreshAccessToken();
			} catch (error) {
				// If refresh fails, redirect to login
				window.location.href = '/login';
				throw error;
			}
		}

		// Add authorization header
		const headers = {
			'Content-Type': 'application/json',
			...options.headers
		};

		if (this.accessToken) {
			headers.Authorization = `Bearer ${this.accessToken}`;
		}

		const requestOptions = {
			...options,
			headers,
			credentials: 'include' // Always include cookies
		};

		try {
			const response = await fetch(url, requestOptions);

			// Handle 401 responses (token expired)
			if (response.status === 401) {
				const errorData = await response.json().catch(() => ({}));
				
				// If token expired, try to refresh and retry
				if (errorData.code === 'TOKEN_EXPIRED') {
					try {
						console.log('[AUTH] Token expired, attempting refresh...');
						await this.refreshAccessToken();
						
						// Retry original request with new token
						requestOptions.headers.Authorization = `Bearer ${this.accessToken}`;
						return fetch(url, requestOptions);
						
					} catch (refreshError) {
						console.error('[AUTH] Token refresh failed, redirecting to login');
						window.location.href = '/login';
						throw refreshError;
					}
				}
				
				// Other 401 errors (invalid token, user not found, etc.)
				this.clearAccessToken();
				this.broadcastLogout();
				window.location.href = '/login';
			}

			return response;
			
		} catch (error) {
			console.error('[AUTH] Request failed:', error);
			throw error;
		}
	}

	// Cross-tab communication for logout
	broadcastLogout() {
		localStorage.setItem('auth_event', JSON.stringify({
			type: 'logout',
			timestamp: Date.now()
		}));
		localStorage.removeItem('auth_event'); // Trigger storage event
	}

	// Cross-tab communication for login
	broadcastLogin(user) {
		localStorage.setItem('auth_event', JSON.stringify({
			type: 'login',
			user,
			timestamp: Date.now()
		}));
		localStorage.removeItem('auth_event'); // Trigger storage event
	}

	// Listen for cross-tab authentication events
	setupCrossTabSync() {
		window.addEventListener('storage', (event) => {
			if (event.key === 'auth_event' && event.newValue) {
				try {
					const authEvent = JSON.parse(event.newValue);
					
					if (authEvent.type === 'logout') {
						console.log('[AUTH] Logout event received from another tab');
						this.clearAccessToken();
						window.location.href = '/login';
					}
					
					if (authEvent.type === 'login') {
						console.log('[AUTH] Login event received from another tab');
						// Optionally refresh current page or update UI
						window.location.reload();
					}
					
				} catch (error) {
					console.error('[AUTH] Failed to parse auth event:', error);
				}
			}
		});
	}

	// Initialize auth service
	init() {
		this.setupCrossTabSync();
		
		// Try to refresh token on app start
		this.refreshAccessToken().catch(() => {
			console.log('[AUTH] No valid refresh token found, clearing session');
			this.clearAccessToken();
			// Only redirect if not already on a public page
			const publicPaths = ['/login', '/signup', '/'];
			if (!publicPaths.includes(window.location.pathname)) {
				window.location.href = '/login';
			}
		});
	}
}

export default new AuthService();