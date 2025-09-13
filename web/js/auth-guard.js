/**
 * UTERNITY Authentication Guard System
 * Handles session persistence, route protection, and authentication state management
 */

class AuthGuard {
    constructor() {
        this.authAPI = window.authAPI;
        this.currentUser = null;
        this.isInitialized = false;
        this.redirectAfterLogin = null;
        
        // Pages that require authentication
        this.protectedPages = [
            '/pages/app/dashboard.html',
            '/pages/app/profile.html',
            '/pages/app/settings.html',
            '/pages/app/chat.html',
            '/pages/app/voice-dashboard.html',
            '/pages/app/voice-test.html',
            '/pages/app/university-recommender.html',
            '/pages/app/university-comparison.html',
            '/pages/app/university-recommendations.html',
            '/pages/app/sop-dashboard.html',
            '/pages/app/sop-workspace.html',
            '/pages/app/sop-create.html',
            '/pages/app/community.html'
        ];
        
        // Pages that should be excluded from protection (debug/test pages)
        this.excludedPages = [
            '/redirect-test.html',
            '/auth-debug.html',
            '/test-header.html',
            '/session-test.html'
        ];
        
        // Pages that should redirect authenticated users
        this.authPages = [
            '/pages/app/auth/login.html',
            '/pages/app/auth/register.html'
        ];
        
        // Initialize authentication state
        this.init();
    }
    
    /**
     * Initialize authentication guard
     */
    async init() {
        try {
            console.log('🚀 AuthGuard: Initializing...');
            
            // First check session persistence
            const sessionRestored = await this.checkSessionPersistence();
            
            if (!sessionRestored) {
                // If session restoration failed, check if user is authenticated
                if (this.authAPI && this.authAPI.isAuthenticated()) {
                    // Verify token is still valid by fetching current user
                    try {
                        this.currentUser = await this.authAPI.getCurrentUser();
                        this.isInitialized = true;
                        this.onAuthStateChange(true, this.currentUser);
                    } catch (error) {
                        // Token might be expired, try to refresh
                        console.warn('Token validation failed, attempting refresh:', error);
                        await this.handleTokenRefresh();
                    }
                } else {
                    this.isInitialized = true;
                    this.onAuthStateChange(false, null);
                }
            } else {
                this.isInitialized = true;
            }
            
            // Set up auth state change listener
            if (this.authAPI) {
                this.authAPI.onAuthStateChange((event, user) => {
                    this.handleAuthStateChange(event, user);
                });
            }
            
            // Check current page protection
            this.checkCurrentPageAccess();
            
            console.log('✅ AuthGuard: Initialization complete');
            
        } catch (error) {
            console.error('❌ AuthGuard: Initialization failed:', error);
            this.isInitialized = true;
            this.handleUnauthenticatedState();
        }
    }
    
    /**
     * Handle token refresh attempts
     */
    async handleTokenRefresh() {
        try {
            await this.authAPI.refreshAccessToken();
            this.currentUser = await this.authAPI.getCurrentUser();
            this.isInitialized = true;
            this.onAuthStateChange(true, this.currentUser);
        } catch (error) {
            console.warn('Token refresh failed:', error);
            this.handleUnauthenticatedState();
        }
    }
    
    /**
     * Handle unauthenticated state
     */
    handleUnauthenticatedState() {
        this.currentUser = null;
        this.isInitialized = true;
        this.authAPI?.clearAuthData();
        this.onAuthStateChange(false, null);
    }
    
    /**
     * Handle authentication state changes
     */
    handleAuthStateChange(event, user) {
        console.log('Auth state changed:', event, user);
        
        switch (event) {
            case 'login':
            case 'register':
                this.currentUser = user;
                this.onAuthStateChange(true, user);
                break;
                
            case 'logout':
            case 'accountDeleted':
                this.currentUser = null;
                this.onAuthStateChange(false, null);
                break;
        }
    }
    
    /**
     * Check if current page requires authentication
     */
    checkCurrentPageAccess() {
        const currentPath = window.location.pathname;
        const isProtected = this.isProtectedPage(currentPath);
        const isAuthPage = this.isAuthPage(currentPath);
        const isAuthenticated = this.isUserAuthenticated();
        
        console.log('🔍 AuthGuard: Checking page access');
        console.log('📍 Current path:', currentPath);
        console.log('🔒 Is protected:', isProtected);
        console.log('🚪 Is auth page:', isAuthPage);
        console.log('✅ Is authenticated:', isAuthenticated);
        console.log('👤 Current user:', this.currentUser);
        
        if (isProtected && !isAuthenticated) {
            console.log('❌ Protected page, not authenticated -> redirect to login');
            this.redirectToLogin(currentPath);
        } else if (isAuthPage && isAuthenticated) {
            console.log('✅ Auth page, already authenticated -> redirect to dashboard');
            this.redirectToDashboard();
        } else {
            console.log('✅ Page access allowed');
        }
    }
    
    /**
     * Check if page is protected
     */
    isProtectedPage(path) {
        // Check if page is excluded from protection first
        const isExcluded = this.excludedPages.some(excludedPath => 
            path.includes(excludedPath) || path.endsWith(excludedPath)
        );
        
        if (isExcluded) {
            return false;
        }
        
        return this.protectedPages.some(protectedPath => 
            path.includes(protectedPath) || path.endsWith(protectedPath)
        );
    }
    
    /**
     * Check if page is an auth page
     */
    isAuthPage(path) {
        return this.authPages.some(authPath => 
            path.includes(authPath) || path.endsWith(authPath)
        );
    }
    
    /**
     * Check if user is authenticated
     */
    isUserAuthenticated() {
        return !!(this.authAPI && this.authAPI.isAuthenticated() && this.currentUser);
    }
    
    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }
    
    /**
     * Redirect to login page
     */
    redirectToLogin(returnUrl = null) {
        const redirect = returnUrl || window.location.pathname;
        this.redirectAfterLogin = redirect;
        
        // Store redirect URL in session storage
        if (redirect !== '/pages/app/auth/login.html') {
            sessionStorage.setItem('auth_redirect', redirect);
        }
        
        window.location.href = '/pages/app/auth/login.html';
    }
    
    /**
     * Redirect to dashboard
     */
    redirectToDashboard() {
        console.log('🏠 AuthGuard: redirectToDashboard called');
        console.log('📍 Current pathname:', window.location.pathname);
        
        const currentPath = window.location.pathname;
        const dashboardPath = '/pages/app/dashboard.html';
        
        // Don't redirect if already on dashboard
        if (currentPath === dashboardPath) {
            console.log('🏠 Already on dashboard, skipping redirect');
            sessionStorage.removeItem('auth_redirect');
            return;
        }
        
        // Check for stored redirect URL
        const redirectUrl = sessionStorage.getItem('auth_redirect');
        console.log('💾 Stored redirect URL:', redirectUrl);
        
        if (redirectUrl && redirectUrl !== currentPath && redirectUrl !== dashboardPath) {
            console.log('↩️ Redirecting to stored URL:', redirectUrl);
            sessionStorage.removeItem('auth_redirect');
            window.location.href = redirectUrl;
        } else {
            console.log('🏠 Redirecting to dashboard: /pages/app/dashboard.html');
            sessionStorage.removeItem('auth_redirect');
            window.location.href = dashboardPath;
        }
    }
    
    /**
     * Logout user and clear session
     */
    async logout() {
        try {
            console.log('🚪 AuthGuard: Starting logout process...');
            
            // Clear current user state
            this.currentUser = null;
            
            // Call API logout if available
            if (this.authAPI) {
                await this.authAPI.logout();
            }
            
            // Clear local storage
            localStorage.removeItem('uternity_user');
            localStorage.removeItem('uternity_access_token');
            localStorage.removeItem('uternity_refresh_token');
            
            // Update UI state
            this.onAuthStateChange(false, null);
            
            console.log('✅ AuthGuard: Logout completed successfully');
            
            // Redirect to login page
            this.redirectToLogin();
            
        } catch (error) {
            console.error('❌ AuthGuard: Logout failed:', error);
            // Even if API logout fails, clear local state
            this.currentUser = null;
            this.authAPI?.clearAuthData();
            this.onAuthStateChange(false, null);
            this.redirectToLogin();
        }
    }
    
    /**
     * Enhanced session persistence check
     */
    async checkSessionPersistence() {
        try {
            console.log('🔄 AuthGuard: Checking session persistence...');
            
            // Check if we have stored tokens
            const accessToken = localStorage.getItem('uternity_access_token');
            const refreshToken = localStorage.getItem('uternity_refresh_token');
            
            if (!accessToken && !refreshToken) {
                console.log('❌ AuthGuard: No stored tokens found');
                return false;
            }
            
            // Try to validate current session
            if (this.authAPI && this.authAPI.isAuthenticated()) {
                try {
                    const user = await this.authAPI.getCurrentUser();
                    if (user) {
                        this.currentUser = user;
                        this.onAuthStateChange(true, user);
                        console.log('✅ AuthGuard: Session restored successfully');
                        return true;
                    }
                } catch (error) {
                    console.warn('⚠️ AuthGuard: Session validation failed, attempting refresh...');
                    
                    // Try to refresh token
                    try {
                        await this.authAPI.refreshAccessToken();
                        const user = await this.authAPI.getCurrentUser();
                        if (user) {
                            this.currentUser = user;
                            this.onAuthStateChange(true, user);
                            console.log('✅ AuthGuard: Session refreshed successfully');
                            return true;
                        }
                    } catch (refreshError) {
                        console.error('❌ AuthGuard: Token refresh failed:', refreshError);
                    }
                }
            }
            
            // If we get here, session restoration failed
            console.log('❌ AuthGuard: Session restoration failed');
            this.handleUnauthenticatedState();
            return false;
            
        } catch (error) {
            console.error('❌ AuthGuard: Session persistence check failed:', error);
            this.handleUnauthenticatedState();
            return false;
        }
    }
    
    /**
     * Require authentication for current page
     */
    requireAuth() {
        if (!this.isInitialized) {
            // Wait for initialization
            setTimeout(() => this.requireAuth(), 100);
            return;
        }
        
        if (!this.isUserAuthenticated()) {
            this.redirectToLogin();
            return false;
        }
        
        return true;
    }
    
    /**
     * Require guest (unauthenticated) for current page
     */
    requireGuest() {
        if (!this.isInitialized) {
            // Wait for initialization
            setTimeout(() => this.requireGuest(), 100);
            return;
        }
        
        if (this.isUserAuthenticated()) {
            this.redirectToDashboard();
            return false;
        }
        
        return true;
    }
    
    /**
     * Handle authentication state change events
     */
    onAuthStateChange(isAuthenticated, user) {
        console.log('🔄 Auth state changed:', { isAuthenticated, user });
        
        // Update UI elements
        this.updateNavigationUI(isAuthenticated, user);
        
        // Update header user info
        this.updateHeaderUserInfo(user);
        
        // Handle page access
        this.checkCurrentPageAccess();
    }
    
    /**
     * Update navigation UI based on authentication state
     */
    updateNavigationUI(isAuthenticated, user) {
        // Update header navigation
        const authButtons = document.querySelector('.auth-buttons');
        const userMenu = document.querySelector('.user-menu');
        const userAvatar = document.querySelector('.user-avatar');
        const loginBtn = document.querySelector('.login-btn');
        const signupBtn = document.querySelector('.signup-btn');
        const logoutBtn = document.querySelector('.logout-btn');
        
        if (isAuthenticated && user) {
            // Show authenticated UI
            if (authButtons) authButtons.style.display = 'none';
            if (userMenu) {
                userMenu.style.display = 'flex';
                
                // Update user info
                const userName = userMenu.querySelector('.user-name');
                if (userName) {
                    userName.textContent = `${user.first_name} ${user.last_name}`;
                }
                
                const userEmail = userMenu.querySelector('.user-email');
                if (userEmail) {
                    userEmail.textContent = user.email;
                }
                
                // Update avatar
                if (userAvatar && user.profile?.avatar_url) {
                    userAvatar.src = user.profile.avatar_url;
                }
            }
            
        } else {
            // Show unauthenticated UI
            if (authButtons) authButtons.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }
        
        // Add logout functionality
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            // Remove existing event listeners by cloning the element
            const newLogoutButton = logoutButton.cloneNode(true);
            logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);
            
            newLogoutButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚪 Logout button clicked from navigation');
                await this.logout();
            });
        }
        
        // Also handle the legacy logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }
    
    /**
     * Update header user info
     */
    updateHeaderUserInfo(user) {
        console.log('👤 Updating header user info:', user);
        
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userInitial = document.getElementById('userInitial');
        
        if (user) {
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];
            const email = user.email || 'No email';
            const initial = (user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase();
            
            if (userName) userName.textContent = fullName;
            if (userEmail) userEmail.textContent = email;
            if (userInitial) userInitial.textContent = initial;
            
            // Save to localStorage for persistence
            localStorage.setItem('uternity_user', JSON.stringify(user));
        } else {
            if (userName) userName.textContent = 'Guest';
            if (userEmail) userEmail.textContent = 'Not signed in';
            if (userInitial) userInitial.textContent = '?';
            
            // Clear from localStorage
            localStorage.removeItem('uternity_user');
        }
    }
    
    /**
     * Add authentication guards to links
     */
    addLinkGuards() {
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            
            if (this.isProtectedPage(href)) {
                link.addEventListener('click', (e) => {
                    if (!this.isUserAuthenticated()) {
                        e.preventDefault();
                        this.redirectToLogin(href);
                    }
                });
            }
        });
    }
    
    /**
     * Wait for authentication to be ready
     */
    async waitForAuth() {
        return new Promise((resolve) => {
            if (this.isInitialized) {
                resolve(this.isUserAuthenticated());
                return;
            }
            
            const checkReady = () => {
                if (this.isInitialized) {
                    resolve(this.isUserAuthenticated());
                } else {
                    setTimeout(checkReady, 50);
                }
            };
            
            checkReady();
        });
    }
    
    /**
     * Get user display name
     */
    getUserDisplayName() {
        if (!this.currentUser) return null;
        return `${this.currentUser.first_name} ${this.currentUser.last_name}`;
    }
    
    /**
     * Check if user has specific permission/role
     */
    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        // For now, all authenticated users have basic permissions
        // This can be extended with role-based access control
        const basicPermissions = ['read', 'profile_edit', 'chat', 'recommendations'];
        return basicPermissions.includes(permission);
    }
}

// Authentication Guard Utilities
class AuthUtils {
    /**
     * Show authentication required modal
     */
    static showAuthRequiredModal() {
        const modal = document.createElement('div');
        modal.className = 'auth-required-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>Authentication Required</h3>
                    <p>Please log in to access this feature.</p>
                    <div class="modal-actions">
                        <button class="btn-secondary modal-cancel">Cancel</button>
                        <button class="btn-primary modal-login">Log In</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle modal actions
        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.modal-login').addEventListener('click', () => {
            document.body.removeChild(modal);
            window.authGuard.redirectToLogin();
        });
        
        // Close on overlay click
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.body.removeChild(modal);
            }
        });
    }
    
    /**
     * Protect a function with authentication check
     */
    static withAuth(fn) {
        return function(...args) {
            if (window.authGuard && window.authGuard.isUserAuthenticated()) {
                return fn.apply(this, args);
            } else {
                AuthUtils.showAuthRequiredModal();
                return null;
            }
        };
    }
    
    /**
     * Show loading state with better UX
     */
    static showLoading(element, text = 'Loading...') {
        if (!element) return;
        
        // Store original content
        element.setAttribute('data-original-text', element.textContent);
        element.setAttribute('data-original-disabled', element.disabled);
        
        // Set loading state
        element.disabled = true;
        element.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            ${text}
        `;
        
        // Add loading class for styling
        element.classList.add('loading');
    }

    /**
     * Hide loading state and restore original content
     */
    static hideLoading(element) {
        if (!element) return;
        
        // Restore original content
        const originalText = element.getAttribute('data-original-text');
        const originalDisabled = element.getAttribute('data-original-disabled');
        
        if (originalText) {
            element.textContent = originalText;
            element.removeAttribute('data-original-text');
        }
        
        if (originalDisabled !== null) {
            element.disabled = originalDisabled === 'true';
            element.removeAttribute('data-original-disabled');
        } else {
            element.disabled = false;
        }
        
        // Remove loading class
        element.classList.remove('loading');
    }

    /**
     * Show success message with auto-dismiss
     */
    static showSuccess(container, message, duration = 5000) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <div class="success-content">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>${message}</span>
                <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to container or body
        (container || document.body).appendChild(successDiv);
        
        // Auto-dismiss after duration
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, duration);
        
        return successDiv;
    }

    /**
     * Show error message with auto-dismiss
     */
    static showError(container, message, duration = 8000) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-content">
                <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>${message}</span>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to container or body
        (container || document.body).appendChild(errorDiv);
        
        // Auto-dismiss after duration
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, duration);
        
        return errorDiv;
    }

    /**
     * Enhanced password strength validation
     */
    static validatePasswordStrength(password) {
        const result = {
            score: 0,
            feedback: [],
            isValid: false
        };
        
        if (!password) {
            result.feedback.push('Password is required');
            return result;
        }
        
        // Length check
        if (password.length >= 8) {
            result.score += 1;
        } else {
            result.feedback.push('Password must be at least 8 characters long');
        }
        
        // Uppercase check
        if (/[A-Z]/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Password must contain at least one uppercase letter');
        }
        
        // Lowercase check
        if (/[a-z]/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Password must contain at least one lowercase letter');
        }
        
        // Number check
        if (/\d/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Password must contain at least one number');
        }
        
        // Special character check
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Password must contain at least one special character');
        }
        
        // Common password check
        const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123'];
        if (commonPasswords.includes(password.toLowerCase())) {
            result.feedback.push('Password is too common');
            result.score = Math.max(0, result.score - 2);
        }
        
        result.isValid = result.score >= 4 && result.feedback.length === 0;
        
        return result;
    }

    /**
     * Show password strength indicator
     */
    static showPasswordStrength(password, container) {
        if (!container) return;
        
        const strength = this.validatePasswordStrength(password);
        const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
        
        container.innerHTML = `
            <div class="password-strength mt-2">
                <div class="flex items-center space-x-2">
                    <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div class="h-2 rounded-full transition-all duration-300 ${strengthColors[strength.score] || 'bg-gray-200'}" 
                             style="width: ${(strength.score / 5) * 100}%"></div>
                    </div>
                    <span class="text-sm font-medium text-gray-600">${strengthLabels[strength.score] || 'None'}</span>
                </div>
                ${strength.feedback.length > 0 ? `
                    <ul class="mt-1 text-xs text-red-600 space-y-1">
                        ${strength.feedback.map(fb => `<li>• ${fb}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }
}

// Initialize global auth guard
document.addEventListener('DOMContentLoaded', () => {
    window.authGuard = new AuthGuard();
    window.AuthUtils = AuthUtils;
    
    // Add link guards after DOM is ready
    setTimeout(() => {
        window.authGuard.addLinkGuards();
    }, 100);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthGuard, AuthUtils };
} 