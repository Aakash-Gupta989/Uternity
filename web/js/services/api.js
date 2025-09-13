/**
 * Voice Agent API Client
 * Handles all HTTP communication with the FastAPI backend
 */

import axios from 'axios';
import Cookies from 'js-cookie';

// API Configuration
const API_CONFIG = {
    BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8080' 
        : `${window.location.protocol}//${window.location.host}`,
    VERSION: '/api',
    TIMEOUT: 30000
};

class VoiceAgentAPI {
    constructor() {
        this.baseURL = `${API_CONFIG.BASE_URL}${API_CONFIG.VERSION}`;
        this.client = this.createAxiosInstance();
        this.setupInterceptors();
    }

    createAxiosInstance() {
        return axios.create({
            baseURL: this.baseURL,
            timeout: API_CONFIG.TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    setupInterceptors() {
        // Request interceptor - add auth token (optional for now)
        this.client.interceptors.request.use(
            (config) => {
                const token = this.getAuthToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('❌ Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor - handle errors
        this.client.interceptors.response.use(
            (response) => {
                console.log(`✅ API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                console.error('❌ Response Error:', error?.response?.status, error?.response?.data);
                
                // Handle authentication errors (skip for now)
                if (error?.response?.status === 401) {
                    console.warn('⚠️ Auth error detected but skipping redirect for demo mode');
                    // this.handleAuthError(); // Disabled for no-auth mode
                }
                
                return Promise.reject(this.formatError(error));
            }
        );
    }

    formatError(error) {
        if (error.response) {
            return {
                status: error.response.status,
                message: error.response.data?.detail || error.response.data?.message || 'API Error',
                data: error.response.data
            };
        } else if (error.request) {
            return {
                status: 0,
                message: 'Network Error - Unable to connect to server',
                data: null
            };
        } else {
            return {
                status: -1,
                message: error.message || 'Unknown Error',
                data: null
            };
        }
    }

    getAuthToken() {
        return localStorage.getItem('voice_agent_token') || Cookies.get('voice_agent_token');
    }

    setAuthToken(token) {
        localStorage.setItem('voice_agent_token', token);
        Cookies.set('voice_agent_token', token, { expires: 1 });
    }

    removeAuthToken() {
        localStorage.removeItem('voice_agent_token');
        Cookies.remove('voice_agent_token');
    }

    handleAuthError() {
        console.warn('🔐 Authentication error - redirecting to login');
        this.removeAuthToken();
        window.location.href = '/frontend/pages/auth/login.html';
    }

    // ============================================================================
    // AUTHENTICATION ENDPOINTS
    // ============================================================================

    async login(credentials) {
        try {
            const response = await this.client.post('/auth/login', credentials);
            
            if (response.data.access_token) {
                this.setAuthToken(response.data.access_token);
                console.log('✅ Login successful');
                return {
                    success: true,
                    data: response.data,
                    user: response.data.user
                };
            }
            
            throw new Error('Invalid response format');
        } catch (error) {
            console.error('❌ Login failed:', error);
            return {
                success: false,
                error: error.message || 'Login failed'
            };
        }
    }

    async logout() {
        try {
            await this.client.post('/auth/logout');
            this.removeAuthToken();
            console.log('✅ Logout successful');
            return { success: true };
        } catch (error) {
            console.error('❌ Logout failed:', error);
            this.removeAuthToken(); // Remove token anyway
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // HEALTH CHECK
    // ============================================================================

    async healthCheck() {
        try {
            const response = await this.client.get('/health/');
            return {
                success: true,
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: 'unhealthy'
            };
        }
    }

    // ============================================================================
    // USER PROFILE
    // ============================================================================

    async getUserProfile() {
        try {
            const response = await this.client.get('/users/profile');
            return {
                success: true,
                user: response.data.user
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateUserProfile(profileData) {
        try {
            const response = await this.client.put('/users/profile', profileData);
            return {
                success: true,
                message: response.data.message
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================================
    // SESSION MANAGEMENT
    // ============================================================================

    async createSession(sessionData) {
        try {
            const response = await this.client.post('/sessions/', sessionData);
            console.log('✅ Session created:', response.data.session.id);
            return {
                success: true,
                session: response.data.session,
                websocket_url: response.data.websocket_url
            };
        } catch (error) {
            console.error('❌ Session creation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getSessions() {
        try {
            const response = await this.client.get('/sessions/');
            return {
                success: true,
                sessions: response.data.sessions
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getSessionStatus(sessionId) {
        try {
            const response = await this.client.get(`/sessions/${sessionId}/status`);
            return {
                success: true,
                session: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================================
    // TOEFL ENDPOINTS - Updated for Authentic Test Engine
    // ============================================================================

    async startTOEFLTest(difficulty = "medium") {
        console.log("🚀 Starting TOEFL test with difficulty:", difficulty);
        try {
            // Generate a unique user ID for demo purposes
            const userId = `demo_user_${Date.now()}`;
            
            const requestData = {
                user_id: userId,
                preferences: {
                    difficulty: difficulty
                },
                mode: "practice"
            };
            
            console.log("📋 Sending TOEFL test request:", requestData);
            const response = await this.client.post('/toefl/start', requestData);
            
            if (!response.data) {
                throw new Error('Empty response from server');
            }
            
            console.log('✅ TOEFL test started:', response.data);
            return {
                success: true,
                session: response.data.session || response.data
            };
        } catch (error) {
            console.error('❌ Failed to start TOEFL test:', error);
            return {
                success: false,
                error: error.response?.data?.detail || error.message || 'Server error'
            };
        }
    }

    async getTOEFLProgress(sessionId) {
        console.log("🔍 Getting TOEFL progress for session:", sessionId);
        try {
            const response = await this.client.get(`/toefl/progress/${sessionId}`);
            console.log("📊 Progress data received:", response);
            
            // Validate content
            if (response.data.content) {
                console.log("📝 Content received:", {
                    title: response.data.content.metadata?.title,
                    taskType: response.data.task_info?.task_type,
                    phase: response.data.progress?.current_phase
                });
            } else {
                console.warn("⚠️ No content in progress response");
            }
            
            return {
                success: true,
                progress: response.data.data || response.data
            };
        } catch (error) {
            console.error("❌ Failed to get TOEFL progress:", error);
            throw error;
        }
    }

    async controlTOEFLTest(sessionId, action) {
        console.log(`🎮 Controlling TOEFL test - Session: ${sessionId}, Action: ${action}`);
        try {
            const response = await this.client.post(`/toefl/control/${sessionId}`, { action });
            console.log("✅ Control action successful:", response);
            return {
                success: true,
                result: response.data
            };
        } catch (error) {
            console.error("❌ Failed to control TOEFL test:", error);
            throw error;
        }
    }

    async getContentPreview(contentId) {
        try {
            const response = await this.client.get(`/content/preview/${contentId}`);
            return {
                success: true,
                content: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getContentStatistics() {
        try {
            const response = await this.client.get('/content/statistics');
            return {
                success: true,
                statistics: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Legacy TOEFL endpoints for backward compatibility
    async startTOEFLSession(sessionData) {
        console.warn('⚠️ Using legacy TOEFL endpoint - consider migrating to startTOEFLTest()');
        return this.startTOEFLTest(sessionData);
    }

    async startTOEFLTask(sessionId, taskNumber) {
        try {
            const response = await this.client.post(`/toefl/session/${sessionId}/task${taskNumber}/start`);
            return {
                success: true,
                task: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async submitTOEFLResponse(sessionId, taskNumber, responseData) {
        try {
            const response = await this.client.post(`/toefl/session/${sessionId}/task${taskNumber}/response`, responseData);
            return {
                success: true,
                result: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getTOEFLScore(sessionId) {
        try {
            const response = await this.client.post(`/toefl/session/${sessionId}/score`);
            return {
                success: true,
                score: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================================
    // IELTS ENDPOINTS
    // ============================================================================

    async startIELTSSession(sessionData) {
        try {
            const response = await this.client.post('/ielts/session/start', sessionData);
            return {
                success: true,
                session: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async startIELTSPart(sessionId, partNumber) {
        try {
            const response = await this.client.post(`/ielts/session/${sessionId}/part${partNumber}/start`);
            return {
                success: true,
                part: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async submitIELTSResponse(sessionId, partNumber, responseData) {
        try {
            const response = await this.client.post(`/ielts/session/${sessionId}/part${partNumber}/response`, responseData);
            return {
                success: true,
                result: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getIELTSScore(sessionId) {
        try {
            const response = await this.client.post(`/ielts/session/${sessionId}/score`);
            return {
                success: true,
                score: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================================
    // AUDIO ENDPOINTS
    // ============================================================================

    async uploadAudio(audioFile, sessionId, metadata = {}) {
        try {
            const formData = new FormData();
            formData.append('file', audioFile);
            formData.append('session_id', sessionId);
            formData.append('user_id', metadata.user_id || 'current_user');
            formData.append('part_task', metadata.part_task || 'unknown');
            
            if (metadata.question_id) {
                formData.append('question_id', metadata.question_id);
            }

            const response = await this.client.post('/voice/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    console.log(`📤 Upload Progress: ${percentCompleted}%`);
                    
                    // Dispatch custom event for upload progress
                    window.dispatchEvent(new CustomEvent('audioUploadProgress', {
                        detail: { percentCompleted, sessionId }
                    }));
                }
            });

            return {
                success: true,
                audio: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const api = new VoiceAgentAPI();

// Export both the class and instance
export default api;
export { VoiceAgentAPI }; 