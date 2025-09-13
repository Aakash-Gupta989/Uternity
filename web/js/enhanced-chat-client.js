/**
 * Enhanced Chat Client with Unified Authentication
 * Integrates with UTERNITY's centralized auth system
 */

class EnhancedChatClient {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || '/chat';
        this.authAPI = window.authAPI; // Use existing auth API
        this.currentSessionId = null;
        this.currentUser = null;
        this.isAuthenticated = false;
        
        // Initialize authentication state
        this.initializeAuth();
    }
    
    async initializeAuth() {
        try {
            // Check if user is authenticated
            if (this.authAPI && this.authAPI.isAuthenticated()) {
                this.isAuthenticated = true;
                this.currentUser = this.authAPI.getUser();
                console.log('🔐 User authenticated:', this.currentUser?.email || 'Unknown');
            } else {
                this.isAuthenticated = false;
                this.currentUser = null;
                console.log('👤 User not authenticated - using anonymous mode');
            }
        } catch (error) {
            console.error('❌ Error initializing auth:', error);
            this.isAuthenticated = false;
        }
    }
    
    async sendMessage(message, context = null) {
        try {
            console.log('📡 Sending enhanced message:', message);
            
            // Prepare request headers
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add authentication header if available
            if (this.isAuthenticated && this.authAPI) {
                const token = localStorage.getItem('uternity_access_token');
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }
            
            // Prepare request body
            const requestBody = {
                message: message,
                session_id: this.currentSessionId,
                context: context
            };
            
            console.log('📤 Enhanced request:', {
                url: this.apiUrl,
                headers: headers,
                body: requestBody
            });
            
            // Make API call
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
            
            console.log('📥 Enhanced response status:', response.status);
            
            if (!response.ok) {
                // Handle specific error cases
                if (response.status === 401) {
                    // Token expired or invalid
                    console.warn('🔑 Authentication expired, attempting refresh...');
                    
                    if (this.authAPI && this.authAPI.refreshToken) {
                        try {
                            await this.authAPI.refreshToken();
                            // Retry the request
                            return await this.sendMessage(message, context);
                        } catch (refreshError) {
                            console.error('❌ Token refresh failed:', refreshError);
                            throw new Error('Authentication expired. Please log in again.');
                        }
                    } else {
                        throw new Error('Authentication required. Please log in.');
                    }
                } else if (response.status === 422) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('❌ Validation error:', errorData);
                    throw new Error('Request validation failed. Please check your input.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            
            const data = await response.json();
            console.log('📥 Enhanced response data:', data);
            
            // Update session ID if provided
            if (data.service_session_id && data.service_session_id !== this.currentSessionId) {
                this.currentSessionId = data.service_session_id;
                localStorage.setItem('uternity_chat_session_id', this.currentSessionId);
                console.log('🆔 Updated session ID:', this.currentSessionId);
            }
            
            return {
                success: true,
                response: data.response,
                sessionId: data.service_session_id,
                userId: data.user_id,
                metadata: {
                    dataSource: data.data_source,
                    ragUsed: data.rag_used,
                    ragConfidence: data.rag_confidence,
                    processingMethod: data.processing_method,
                    responseTime: data.response_time,
                    links: data.links || [],
                    userInfo: data.user_info
                },
                timestamp: data.timestamp
            };
            
        } catch (error) {
            console.error('❌ Enhanced chat error:', error);
            return {
                success: false,
                error: error.message,
                response: `Sorry, I encountered an error: ${error.message}`
            };
        }
    }
    
    async getUserHistory(limit = 50) {
        try {
            if (!this.isAuthenticated) {
                throw new Error('Authentication required to view history');
            }
            
            const token = localStorage.getItem('uternity_access_token');
            const response = await fetch(`${this.apiUrl}/history?limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get history: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Error getting user history:', error);
            throw error;
        }
    }
    
    async createNewSession() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add authentication header if available
            if (this.isAuthenticated) {
                const token = localStorage.getItem('uternity_access_token');
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }
            
            const response = await fetch(`${this.apiUrl}/session/new`, {
                method: 'POST',
                headers: headers
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create session: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentSessionId = data.session_id;
            localStorage.setItem('uternity_chat_session_id', this.currentSessionId);
            
            console.log('🆕 Created new enhanced session:', this.currentSessionId);
            return data;
            
        } catch (error) {
            console.error('❌ Error creating new session:', error);
            throw error;
        }
    }
    
    getAuthenticationStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            user: this.currentUser,
            sessionId: this.currentSessionId
        };
    }
    
    async refreshAuthentication() {
        await this.initializeAuth();
        return this.getAuthenticationStatus();
    }
}

// Global instance for easy access
window.enhancedChatClient = new EnhancedChatClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedChatClient;
}
