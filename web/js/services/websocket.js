/**
 * Voice Agent WebSocket Client
 * Handles real-time communication with the FastAPI backend
 */

import { io } from 'socket.io-client';

// WebSocket Configuration
const WS_CONFIG = {
    BASE_URL: window.location.hostname === 'localhost' 
        ? 'ws://localhost:8080/ws' 
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`,
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 1000,
    AUTH_TIMEOUT: 10000,
    HEARTBEAT_INTERVAL: 30000
};

class VoiceAgentWebSocket {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.userId = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = WS_CONFIG.MAX_RECONNECT_ATTEMPTS;
        this.reconnectDelay = WS_CONFIG.RECONNECT_DELAY;
        this.eventListeners = new Map();
        this.heartbeatInterval = null;
    }

    // ============================================================================
    // CONNECTION MANAGEMENT
    // ============================================================================

    async connect(sessionId, authToken) {
        return new Promise((resolve, reject) => {
            try {
                this.sessionId = sessionId;
                
                console.log(`🔌 Connecting to WebSocket: ${sessionId}`);
                
                // Create WebSocket connection
                this.socket = new WebSocket(`${WS_CONFIG.BASE_URL}/api/v1/ws/${sessionId}`);
                
                this.socket.onopen = () => {
                    console.log('✅ WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // Authenticate immediately after connection
                    this.authenticate(authToken)
                        .then(() => {
                            this.startHeartbeat();
                            this.emit('connected', { sessionId, userId: this.userId });
                            resolve(true);
                        })
                        .catch((error) => {
                            console.error('❌ Authentication failed:', error);
                            reject(error);
                        });
                };
                
                this.socket.onmessage = (event) => {
                    this.handleMessage(event);
                };
                
                this.socket.onclose = (event) => {
                    console.warn('🔌 WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    this.isAuthenticated = false;
                    this.stopHeartbeat();
                    this.emit('disconnected', { code: event.code, reason: event.reason });
                    
                    // Attempt reconnection if not a clean close
                    if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.attemptReconnect(authToken);
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.emit('error', { error });
                    reject(error);
                };
                
            } catch (error) {
                console.error('❌ WebSocket connection failed:', error);
                reject(error);
            }
        });
    }

    async disconnect() {
        console.log('🔌 Disconnecting WebSocket...');
        
        this.stopHeartbeat();
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close(1000, 'Client disconnect');
        }
        
        this.isConnected = false;
        this.isAuthenticated = false;
        this.sessionId = null;
        this.userId = null;
        this.socket = null;
        
        console.log('✅ WebSocket disconnected');
    }

    async attemptReconnect(authToken) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(async () => {
            try {
                await this.connect(this.sessionId, authToken);
                console.log('✅ Reconnection successful');
                this.emit('reconnected');
            } catch (error) {
                console.error('❌ Reconnection failed:', error);
                
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('❌ Max reconnection attempts reached');
                    this.emit('reconnectionFailed');
                }
            }
        }, delay);
    }

    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    async authenticate(authToken) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            // Listen for auth response
            const authListener = (data) => {
                if (data.type === 'authenticated') {
                    this.isAuthenticated = true;
                    this.userId = data.user_id;
                    console.log('✅ WebSocket authenticated:', data.user_id);
                    this.off('message', authListener);
                    resolve(data);
                } else if (data.type === 'auth_error') {
                    console.error('❌ WebSocket authentication failed:', data.message);
                    this.off('message', authListener);
                    reject(new Error(data.message));
                }
            };
            
            this.on('message', authListener);
            
            // Send authentication message
            this.send({
                type: 'auth',
                token: authToken,
                session_id: this.sessionId
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.isAuthenticated) {
                    this.off('message', authListener);
                    reject(new Error('Authentication timeout'));
                }
            }, WS_CONFIG.AUTH_TIMEOUT);
        });
    }

    // ============================================================================
    // MESSAGE HANDLING
    // ============================================================================

    send(message) {
        if (!this.isConnected || !this.socket) {
            console.warn('⚠️ Cannot send message - WebSocket not connected');
            return false;
        }

        try {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            this.socket.send(messageStr);
            console.log('📤 WebSocket message sent:', message.type || 'raw');
            return true;
        } catch (error) {
            console.error('❌ Failed to send WebSocket message:', error);
            return false;
        }
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📥 WebSocket message received:', data.type || 'unknown');
            
            // Handle system messages
            switch (data.type) {
                case 'pong':
                    this.emit('heartbeat', data);
                    break;
                    
                case 'error':
                    console.error('❌ WebSocket server error:', data.message);
                    this.emit('error', data);
                    break;
                    
                case 'session_updated':
                    this.emit('sessionUpdated', data);
                    break;
                    
                case 'audio_processed':
                    this.emit('audioProcessed', data);
                    break;
                    
                case 'transcription':
                    this.emit('transcription', data);
                    break;
                    
                case 'ai_response':
                    this.emit('aiResponse', data);
                    break;
                    
                case 'real_time_feedback':
                    this.emit('realTimeFeedback', data);
                    break;
                    
                default:
                    // Emit generic message event
                    this.emit('message', data);
                    break;
            }
            
        } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
            this.emit('parseError', { error, rawData: event.data });
        }
    }

    // ============================================================================
    // HEARTBEAT
    // ============================================================================

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping', timestamp: new Date().toISOString() });
            }
        }, WS_CONFIG.HEARTBEAT_INTERVAL); // 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // ============================================================================
    // AUDIO STREAMING
    // ============================================================================

    startAudioStream() {
        if (!this.isAuthenticated) {
            console.warn('⚠️ Cannot start audio stream - not authenticated');
            return false;
        }

        this.send({
            type: 'start_audio_stream',
            session_id: this.sessionId,
            timestamp: new Date().toISOString()
        });
        
        return true;
    }

    sendAudioChunk(audioData, chunkId = null) {
        if (!this.isAuthenticated) {
            console.warn('⚠️ Cannot send audio chunk - not authenticated');
            return false;
        }

        // Convert audio data to base64 if it's not already
        const audioBase64 = audioData instanceof ArrayBuffer 
            ? this.arrayBufferToBase64(audioData)
            : audioData;

        this.send({
            type: 'audio_chunk',
            data: {
                chunk_id: chunkId || `chunk_${Date.now()}`,
                audio_buffer: audioBase64,
                timestamp: new Date().toISOString()
            }
        });
        
        return true;
    }

    stopAudioStream() {
        this.send({
            type: 'stop_audio_stream',
            session_id: this.sessionId,
            timestamp: new Date().toISOString()
        });
    }

    // ============================================================================
    // CONVERSATION MANAGEMENT
    // ============================================================================

    startConversation(testType, taskType) {
        if (!this.isAuthenticated) {
            console.warn('⚠️ Cannot start conversation - not authenticated');
            return false;
        }

        this.send({
            type: 'conversation_start',
            data: {
                test_type: testType,
                task_type: taskType,
                session_id: this.sessionId
            }
        });
        
        return true;
    }

    sendConversationMessage(message) {
        if (!this.isAuthenticated) {
            console.warn('⚠️ Cannot send conversation message - not authenticated');
            return false;
        }

        this.send({
            type: 'conversation_message',
            data: {
                message: message,
                timestamp: new Date().toISOString()
            }
        });
        
        return true;
    }

    // ============================================================================
    // EVENT SYSTEM
    // ============================================================================

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('❌ Event listener error:', error);
                }
            });
        }
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        return btoa(binary);
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            isAuthenticated: this.isAuthenticated,
            sessionId: this.sessionId,
            userId: this.userId,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// Create singleton instance
const websocket = new VoiceAgentWebSocket();

// Export both the class and instance
export default websocket;
export { VoiceAgentWebSocket }; 