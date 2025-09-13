/**
 * UTERNITY Authentication API Client
 * JavaScript client for authentication service integration
 * Handles all authentication-related API calls and token management
 */

class UternityAuthAPI {
    constructor(config = {}) {
        // API Configuration
        this.baseURL = config.baseURL || 'http://localhost:8001/auth';
        this.apiVersion = config.apiVersion || 'v1';
        this.timeout = config.timeout || 10000;
        
        // Token management
        this.accessToken = localStorage.getItem('uternity_access_token');
        this.refreshToken = localStorage.getItem('uternity_refresh_token');
        
        // Safely parse user data from localStorage
        try {
            const userData = localStorage.getItem('uternity_user');
            this.user = userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.warn('Error parsing user data from localStorage:', error);
            this.user = null;
            localStorage.removeItem('uternity_user');
        }
        
        // Request interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        // Event listeners for auth state changes
        this.authStateListeners = [];
        
        // Initialize token refresh mechanism
        this.initTokenRefresh();
    }
    
    /**
     * Get full API endpoint URL
     */
    getEndpoint(path) {
        return `${this.baseURL}${path}`;
    }
    
    /**
     * Make HTTP request with automatic token management
     */
    async request(endpoint, options = {}) {
        const url = this.getEndpoint(endpoint);
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        // Add authorization header if token exists
        if (this.accessToken && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        
        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            await interceptor(config);
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Apply response interceptors
            for (const interceptor of this.responseInterceptors) {
                await interceptor(response);
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new AuthAPIError(data.detail || 'Request failed', response.status, data);
            }
            
            return data;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new AuthAPIError('Request timeout', 408);
            }
            
            // Handle 401 errors with token refresh
            if (error.status === 401 && this.refreshToken && endpoint !== 'http://localhost:8001/auth/refresh') {
                try {
                    await this.refreshAccessToken();
                    // Retry the original request
                    return this.request(endpoint, options);
                } catch (refreshError) {
                    this.logout();
                    throw refreshError;
                }
            }
            
            throw error;
        }
    }
    
    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const url = new URL(this.getEndpoint(endpoint));
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return this.request(url.pathname + url.search, {
            method: 'GET'
        });
    }
    
    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
    
    /**
     * Register new user
     */
    async register(userData) {
        try {
            const response = await this.post('http://localhost:8001/auth/register', userData);
            
            // Store tokens and user data
            this.setAuthData(response);
            
            // Notify auth state change
            this.notifyAuthStateChange('register', response.user);
            
            return response;
        } catch (error) {
            throw this.handleAuthError(error, 'Registration failed');
        }
    }
    
    /**
     * Login user
     */
    async login(credentials) {
        try {
            const response = await this.post('http://localhost:8001/auth/login', credentials);
            
            // Store tokens and user data
            this.setAuthData(response);
            
            // Notify auth state change
            this.notifyAuthStateChange('login', response.user);
            
            return response;
        } catch (error) {
            throw this.handleAuthError(error, 'Login failed');
        }
    }
    
    /**
     * Logout user
     */
    async logout() {
        try {
            // Call logout endpoint
            await this.post('http://localhost:8001/auth/logout');
            
            // Clear all auth data
            this.clearAuthData();
            
            // Notify auth state change
            this.notifyAuthStateChange('logout', null);
            
            return true;
        } catch (error) {
            throw this.handleAuthError(error, 'Logout failed');
        }
    }
    
    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new AuthAPIError('No refresh token available', 401);
        }
        
        try {
            const response = await this.post('http://localhost:8001/auth/refresh', {
                refresh_token: this.refreshToken
            });
            
            // Update tokens
            this.setAuthData(response);
            
            return response;
        } catch (error) {
            this.clearAuthData();
            throw this.handleAuthError(error, 'Token refresh failed');
        }
    }
    
    /**
     * Get current user info
     */
    async getCurrentUser() {
        try {
            const response = await this.get('http://localhost:8001/auth/me');
            
            // Update stored user data
            this.user = response;
            localStorage.setItem('uternity_user', JSON.stringify(response));
            
            return response;
        } catch (error) {
            throw this.handleAuthError(error, 'Failed to get user info');
        }
    }
    
    /**
     * Change password
     */
    async changePassword(passwords) {
        try {
            return await this.post('http://localhost:8001/auth/change-password', passwords);
        } catch (error) {
            throw this.handleAuthError(error, 'Password change failed');
        }
    }
    
    /**
     * Forgot password
     */
    async forgotPassword(email) {
        try {
            return await this.post('http://localhost:8001/auth/forgot-password', { email });
        } catch (error) {
            throw this.handleAuthError(error, 'Password reset request failed');
        }
    }
    
    /**
     * Reset password
     */
    async resetPassword(token, newPassword) {
        try {
            return await this.post('http://localhost:8001/auth/reset-password', {
                token,
                new_password: newPassword
            });
        } catch (error) {
            throw this.handleAuthError(error, 'Password reset failed');
        }
    }
    
    /**
     * Get user profile
     */
    async getUserProfile() {
        try {
            return await this.get('/users/profile');
        } catch (error) {
            throw this.handleAuthError(error, 'Failed to get user profile');
        }
    }
    
    /**
     * Update user profile
     */
    async updateProfile(profileData) {
        try {
            const response = await this.put('/users/profile', profileData);
            
            // Update stored user data
            this.user = response;
            localStorage.setItem('uternity_user', JSON.stringify(response));
            
            return response;
        } catch (error) {
            throw this.handleAuthError(error, 'Profile update failed');
        }
    }
    
    /**
     * Update user preferences
     */
    async updatePreferences(preferences) {
        try {
            const response = await this.put('/users/preferences', preferences);
            
            // Update stored user data
            this.user = response;
            localStorage.setItem('uternity_user', JSON.stringify(response));
            
            return response;
        } catch (error) {
            throw this.handleAuthError(error, 'Preferences update failed');
        }
    }
    
    /**
     * Upload user avatar
     */
    async uploadAvatar(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            return await this.request('/users/upload-avatar', {
                method: 'POST',
                body: formData,
                headers: {} // Remove Content-Type to let browser set it for FormData
            });
        } catch (error) {
            throw this.handleAuthError(error, 'Avatar upload failed');
        }
    }
    
    /**
     * Delete user avatar
     */
    async deleteAvatar() {
        try {
            return await this.delete('/users/avatar');
        } catch (error) {
            throw this.handleAuthError(error, 'Avatar deletion failed');
        }
    }
    
    /**
     * Delete user account
     */
    async deleteAccount() {
        try {
            const response = await this.delete('/users/account');
            
            // Clear auth data after successful deletion
            this.clearAuthData();
            this.notifyAuthStateChange('accountDeleted', null);
            
            return response;
        } catch (error) {
            throw this.handleAuthError(error, 'Account deletion failed');
        }
    }
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.accessToken && this.user);
    }
    
    /**
     * Get current user
     */
    getUser() {
        return this.user;
    }
    
    /**
     * Set authentication data
     */
    setAuthData(authResponse) {
        // Store tokens
        if (authResponse.access_token) {
            this.accessToken = authResponse.access_token;
            localStorage.setItem('uternity_access_token', authResponse.access_token);
        }
        
        if (authResponse.refresh_token) {
            this.refreshToken = authResponse.refresh_token;
            localStorage.setItem('uternity_refresh_token', authResponse.refresh_token);
        }
        
        // Store user data
        if (authResponse.user) {
            this.user = authResponse.user;
            localStorage.setItem('uternity_user', JSON.stringify(authResponse.user));
        }
    }
    
    /**
     * Clear authentication data
     */
    clearAuthData() {
        // Clear tokens
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        
        // Clear localStorage
        localStorage.removeItem('uternity_access_token');
        localStorage.removeItem('uternity_refresh_token');
        localStorage.removeItem('uternity_user');
    }
    
    /**
     * Initialize automatic token refresh
     */
    initTokenRefresh() {
        // Check token expiry every 5 minutes
        setInterval(() => {
            this.checkTokenExpiry();
        }, 5 * 60 * 1000);
        
        // Check on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkTokenExpiry();
            }
        });
    }
    
    /**
     * Check token expiry and refresh if needed
     */
    async checkTokenExpiry() {
        if (!this.accessToken || !this.refreshToken) {
            return;
        }
        
        try {
            // Decode JWT to check expiry (simple check, not cryptographically secure)
            const tokenPayload = JSON.parse(atob(this.accessToken.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            
            // Refresh if token expires in next 5 minutes
            if (tokenPayload.exp - currentTime < 300) {
                await this.refreshAccessToken();
            }
        } catch (error) {
            console.warn('Token expiry check failed:', error);
        }
    }
    
    /**
     * Add auth state change listener
     */
    onAuthStateChange(listener) {
        this.authStateListeners.push(listener);
        
        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(listener);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify auth state change
     */
    notifyAuthStateChange(event, user) {
        this.authStateListeners.forEach(listener => {
            try {
                listener(event, user);
            } catch (error) {
                console.error('Auth state listener error:', error);
            }
        });
    }
    
    /**
     * Handle authentication errors
     */
    handleAuthError(error, defaultMessage) {
        if (error instanceof AuthAPIError) {
            return error;
        }
        
        return new AuthAPIError(
            error.message || defaultMessage,
            error.status || 500,
            error.data
        );
    }
    
    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    
    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        try {
            return await this.get('/health');
        } catch (error) {
            throw new AuthAPIError('Health check failed', error.status || 503);
        }
    }
}

/**
 * Custom error class for authentication API errors
 */
class AuthAPIError extends Error {
    constructor(message, status = 500, data = null) {
        super(message);
        this.name = 'AuthAPIError';
        this.status = status;
        this.data = data;
    }
    
    /**
     * Check if error is specific type
     */
    isValidationError() {
        return this.status === 422;
    }
    
    isUnauthorized() {
        return this.status === 401;
    }
    
    isForbidden() {
        return this.status === 403;
    }
    
    isNotFound() {
        return this.status === 404;
    }
    
    isRateLimited() {
        return this.status === 429;
    }
    
    isServerError() {
        return this.status >= 500;
    }
}

/**
 * Utility functions for auth UI
 */
class AuthUIHelpers {
    /**
     * Show loading state on element
     */
    static showLoading(element, text = 'Loading...') {
        if (!element) {
            console.warn('showLoading: element is null');
            return;
        }
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.innerHTML = `
            <span class="spinner"></span>
            ${text}
        `;
    }
    
    /**
     * Hide loading state on element
     */
    static hideLoading(element) {
        if (!element) {
            console.warn('hideLoading: element is null');
            return;
        }
        element.disabled = false;
        element.textContent = element.dataset.originalText || 'Submit';
    }
    
    /**
     * Show error message
     */
    static showError(container, message, duration = 5000) {
        if (!container) {
            console.warn('showError: container is null, using document.body');
            container = document.body;
        }
        
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <div class="error-content">
                <i class="error-icon">⚠️</i>
                <span>${message}</span>
                <button class="error-close">&times;</button>
            </div>
        `;
        
        container.appendChild(errorElement);
        
        // Auto remove after duration
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, duration);
        
        // Manual close
        errorElement.querySelector('.error-close').addEventListener('click', () => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        });
    }
    
    /**
     * Show success message
     */
    static showSuccess(container, message, duration = 3000) {
        if (!container) {
            console.warn('showSuccess: container is null, using document.body');
            container = document.body;
        }
        
        const successElement = document.createElement('div');
        successElement.className = 'success-message';
        successElement.innerHTML = `
            <div class="success-content">
                <i class="success-icon">✅</i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(successElement);
        
        // Auto remove after duration
        setTimeout(() => {
            if (successElement.parentNode) {
                successElement.parentNode.removeChild(successElement);
            }
        }, duration);
    }
    
    /**
     * Validate email format
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * Validate password strength
     */
    static validatePassword(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        const score = Object.values(checks).filter(Boolean).length;
        
        return {
            isValid: score === 5,
            score: score,
            checks: checks,
            strength: score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong'
        };
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UternityAuthAPI, AuthAPIError, AuthUIHelpers };
}

// Create global instance for browser use
if (typeof window !== 'undefined') {
    window.UternityAuthAPI = UternityAuthAPI;
    window.AuthAPIError = AuthAPIError;
    window.AuthUIHelpers = AuthUIHelpers;
    
    // Create default instance with error handling
    try {
        window.authAPI = new UternityAuthAPI();
        console.log('✅ UTERNITY Auth API initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize UTERNITY Auth API:', error);
        // Create a minimal fallback to prevent complete failure
        window.authAPI = null;
    }
} 