/**
 * Voice Agent Authentication Service
 * Handles user authentication, session management, and user state
 */

import api from './api.js';
import Cookies from 'js-cookie';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authListeners = [];
        this.demoMode = true; // Enable demo mode for now
        this.initializeAuth();
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initializeAuth() {
        if (this.demoMode) {
            console.log('🔐 Demo mode enabled - setting up demo user');
            this.setupDemoUser();
            return;
        }
        
        const token = this.getStoredToken();
        if (token) {
            console.log('🔐 Found stored token, validating...');
            await this.validateStoredAuth();
        } else {
            console.log('🔐 No stored authentication found');
        }
    }

    setupDemoUser() {
        this.currentUser = {
            id: 'demo-user',
            email: 'demo@voiceagent.com',
            name: 'Demo User',
            profile: {},
            preferences: {},
            analytics: {}
        };
        this.isAuthenticated = true;
        console.log('✅ Demo user setup complete');
        this.notifyAuthListeners('authenticated', this.currentUser);
    }

    async validateStoredAuth() {
        try {
            const result = await api.getUserProfile();
            if (result.success) {
                this.currentUser = result.user;
                this.isAuthenticated = true;
                console.log('✅ Stored authentication valid:', this.currentUser.email);
                this.notifyAuthListeners('authenticated', this.currentUser);
                return true;
            } else {
                console.warn('⚠️ Stored token invalid, clearing...');
                this.clearAuth();
                return false;
            }
        } catch (error) {
            console.error('❌ Auth validation failed:', error);
            this.clearAuth();
            return false;
        }
    }

    // ============================================================================
    // AUTHENTICATION METHODS
    // ============================================================================

    async login(email, password) {
        try {
            console.log('🔐 Attempting login for:', email);
            
            const result = await api.login({ email, password });
            
            if (result.success) {
                this.currentUser = result.user;
                this.isAuthenticated = true;
                
                // Store user info locally
                this.storeUserInfo(result.user);
                
                console.log('✅ Login successful:', this.currentUser.email);
                this.notifyAuthListeners('authenticated', this.currentUser);
                
                return {
                    success: true,
                    user: this.currentUser,
                    token: result.data.access_token
                };
            } else {
                console.error('❌ Login failed:', result.error);
                return {
                    success: false,
                    error: result.error || 'Invalid credentials'
                };
            }
            
        } catch (error) {
            console.error('❌ Login error:', error);
            return {
                success: false,
                error: 'Network error - please try again'
            };
        }
    }

    // ============================================================================
    // OAUTH AUTHENTICATION METHODS
    // ============================================================================

    async initiateOAuth(provider, returnTo = null) {
        try {
            console.log(`🔐 Initiating OAuth for ${provider}`);
            
            const response = await fetch(`${api.baseUrl}/auth/oauth/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: provider,
                    return_to: returnTo || window.location.origin + '/frontend/pages/app/dashboard.html'
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ OAuth URL generated for ${provider}`);
                return {
                    success: true,
                    authorization_url: result.authorization_url,
                    state: result.state
                };
            } else {
                console.error(`❌ OAuth initiation failed for ${provider}:`, result.message);
                return {
                    success: false,
                    error: result.message || 'OAuth initiation failed'
                };
            }
            
        } catch (error) {
            console.error(`❌ OAuth initiation error for ${provider}:`, error);
            return {
                success: false,
                error: 'Network error - please try again'
            };
        }
    }

    async handleOAuthCallback(urlParams) {
        try {
            console.log('🔐 Handling OAuth callback');
            
            // Extract tokens from URL parameters
            const accessToken = urlParams.get('access_token');
            const refreshToken = urlParams.get('refresh_token');
            const sessionId = urlParams.get('session_id');
            const isNewUser = urlParams.get('new_user') === 'true';

            if (accessToken) {
                // Store tokens
                localStorage.setItem('voice_agent_token', accessToken);
                if (refreshToken) {
                    localStorage.setItem('voice_agent_refresh_token', refreshToken);
                }
                if (sessionId) {
                    localStorage.setItem('voice_agent_session_id', sessionId);
                }

                // Get user profile
                const userResult = await this.getUserProfile();
                
                if (userResult.success) {
                    this.currentUser = userResult.user;
                    this.isAuthenticated = true;
                    this.storeUserInfo(userResult.user);
                    
                    console.log('✅ OAuth login successful:', this.currentUser.email);
                    this.notifyAuthListeners('authenticated', this.currentUser);
                    
                    return {
                        success: true,
                        user: this.currentUser,
                        isNewUser: isNewUser
                    };
                } else {
                    throw new Error('Failed to get user profile after OAuth');
                }
            } else {
                throw new Error('No access token received');
            }
            
        } catch (error) {
            console.error('❌ OAuth callback error:', error);
            this.clearAuth();
            return {
                success: false,
                error: error.message || 'OAuth authentication failed'
            };
        }
    }

    async linkOAuthAccount(provider, code, state) {
        try {
            console.log(`🔐 Linking ${provider} account`);
            
            if (!this.isAuthenticated) {
                throw new Error('Must be logged in to link OAuth account');
            }

            const response = await fetch(`${api.baseUrl}/auth/oauth/${provider}/link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getStoredToken()}`
                },
                body: JSON.stringify({
                    provider: provider,
                    oauth_code: code,
                    oauth_state: state
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ ${provider} account linked successfully`);
                // Refresh user profile to get updated OAuth accounts
                await this.refreshUserProfile();
                return {
                    success: true,
                    message: result.message,
                    linked_providers: result.linked_providers
                };
            } else {
                throw new Error(result.error || 'Account linking failed');
            }
            
        } catch (error) {
            console.error(`❌ OAuth account linking error for ${provider}:`, error);
            return {
                success: false,
                error: error.message || 'Account linking failed'
            };
        }
    }

    async unlinkOAuthAccount(provider) {
        try {
            console.log(`🔐 Unlinking ${provider} account`);
            
            if (!this.isAuthenticated) {
                throw new Error('Must be logged in to unlink OAuth account');
            }

            const response = await fetch(`${api.baseUrl}/auth/oauth/${provider}/unlink`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.getStoredToken()}`
                }
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ ${provider} account unlinked successfully`);
                // Refresh user profile to get updated OAuth accounts
                await this.refreshUserProfile();
                return {
                    success: true,
                    message: result.message,
                    linked_providers: result.linked_providers
                };
            } else {
                throw new Error(result.error || 'Account unlinking failed');
            }
            
        } catch (error) {
            console.error(`❌ OAuth account unlinking error for ${provider}:`, error);
            return {
                success: false,
                error: error.message || 'Account unlinking failed'
            };
        }
    }

    async getLinkedAccounts() {
        try {
            if (!this.isAuthenticated) {
                return { success: false, error: 'Not authenticated' };
            }

            const response = await fetch(`${api.baseUrl}/auth/oauth/accounts`, {
                headers: {
                    'Authorization': `Bearer ${this.getStoredToken()}`
                }
            });

            const result = await response.json();

            if (result.success) {
                return {
                    success: true,
                    linked_accounts: result.linked_accounts,
                    total_linked: result.total_linked
                };
            } else {
                throw new Error(result.error || 'Failed to get linked accounts');
            }
            
        } catch (error) {
            console.error('❌ Failed to get linked accounts:', error);
            return {
                success: false,
                error: error.message || 'Failed to get linked accounts'
            };
        }
    }

    async getUserProfile() {
        try {
            const response = await fetch(`${api.baseUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.getStoredToken()}`
                }
            });

            if (response.ok) {
                const user = await response.json();
                return { success: true, user: user };
            } else {
                throw new Error('Failed to get user profile');
            }
            
        } catch (error) {
            console.error('❌ Failed to get user profile:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            console.log('🔐 Logging out...');
            
            const result = await api.logout();
            
            this.clearAuth();
            this.notifyAuthListeners('unauthenticated');
            
            console.log('✅ Logout successful');
            
            return {
                success: true
            };
            
        } catch (error) {
            console.error('❌ Logout error:', error);
            
            // Clear local auth even if server request failed
            this.clearAuth();
            this.notifyAuthListeners('unauthenticated');
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================================
    // TOKEN MANAGEMENT
    // ============================================================================

    getStoredToken() {
        return localStorage.getItem('voice_agent_token') || Cookies.get('voice_agent_token');
    }

    storeUserInfo(user) {
        try {
            localStorage.setItem('voice_agent_user', JSON.stringify(user));
            localStorage.setItem('voice_agent_user_id', user.id);
            localStorage.setItem('voice_agent_last_login', new Date().toISOString());
            
            console.log('✅ User info stored locally');
        } catch (error) {
            console.error('❌ Failed to store user info:', error);
        }
    }

    getStoredUserInfo() {
        try {
            const userStr = localStorage.getItem('voice_agent_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('❌ Failed to parse stored user info:', error);
            return null;
        }
    }

    clearAuth() {
        this.currentUser = null;
        this.isAuthenticated = false;
        
        // Clear stored data
        localStorage.removeItem('voice_agent_token');
        localStorage.removeItem('voice_agent_user');
        localStorage.removeItem('voice_agent_user_id');
        localStorage.removeItem('voice_agent_last_login');
        
        Cookies.remove('voice_agent_token');
        
        console.log('🔐 Authentication cleared');
    }

    // ============================================================================
    // USER PROFILE MANAGEMENT
    // ============================================================================

    async refreshUserProfile() {
        if (!this.isAuthenticated) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const result = await api.getUserProfile();
            if (result.success) {
                this.currentUser = result.user;
                this.storeUserInfo(result.user);
                this.notifyAuthListeners('profileUpdated', this.currentUser);
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('❌ Failed to refresh user profile:', error);
            return { success: false, error: error.message };
        }
    }

    async updateProfile(profileData) {
        if (!this.isAuthenticated) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const result = await api.updateUserProfile(profileData);
            if (result.success) {
                // Refresh user profile after update
                await this.refreshUserProfile();
                return { success: true, message: result.message };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('❌ Failed to update profile:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // AUTH STATE MANAGEMENT
    // ============================================================================

    onAuthChange(callback) {
        this.authListeners.push(callback);
        
        // Immediately call with current state
        if (this.isAuthenticated) {
            callback('authenticated', this.currentUser);
        } else {
            callback('unauthenticated');
        }
        
        // Return unsubscribe function
        return () => {
            const index = this.authListeners.indexOf(callback);
            if (index > -1) {
                this.authListeners.splice(index, 1);
            }
        };
    }

    notifyAuthListeners(event, data = null) {
        this.authListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('❌ Auth listener error:', error);
            }
        });
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    getCurrentUser() {
        return this.currentUser;
    }

    getUserId() {
        return this.currentUser?.id || localStorage.getItem('voice_agent_user_id');
    }

    isLoggedIn() {
        return this.isAuthenticated && this.currentUser !== null;
    }

    requireAuth() {
        if (!this.isLoggedIn()) {
            console.warn('🔐 Authentication required - redirecting to login');
            window.location.href = '/frontend/pages/auth/login.html';
            return false;
        }
        return true;
    }

    getAuthHeaders() {
        const token = this.getStoredToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    // ============================================================================
    // DEMO USER HELPER
    // ============================================================================

    async loginWithDemo() {
        return await this.login('demo@voiceagent.com', 'demo123');
    }

    // ============================================================================
    // SESSION HELPERS
    // ============================================================================

    getSessionInfo() {
        return {
            isAuthenticated: this.isAuthenticated,
            user: this.currentUser,
            userId: this.getUserId(),
            lastLogin: localStorage.getItem('voice_agent_last_login'),
            hasToken: !!this.getStoredToken()
        };
    }

    // ============================================================================
    // ERROR HANDLING
    // ============================================================================

    handleAuthError(error) {
        console.error('🔐 Authentication error:', error);
        
        if (error.status === 401) {
            console.warn('🔐 Token expired or invalid - clearing auth');
            this.clearAuth();
            this.notifyAuthListeners('unauthenticated');
        }
    }
}

// Create singleton instance
const auth = new AuthService();

// Export both the class and instance
export default auth;
export { AuthService };

// Global auth state checker for pages
window.checkAuth = () => {
    return auth.isLoggedIn();
};

// Global logout function
window.logout = () => {
    return auth.logout();
}; 