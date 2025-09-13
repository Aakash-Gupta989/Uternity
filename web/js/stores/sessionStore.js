/**
 * Voice Agent Session Store
 * Manages test sessions, progress, and voice test state
 */

import api from '../services/api.js';
import auth from '../services/auth.js';
import websocket from '../services/websocket.js';
import { v4 as uuidv4 } from 'uuid';

class SessionStore {
    constructor() {
        this.currentSession = null;
        this.sessions = [];
        this.isLoading = false;
        this.error = null;
        this.sessionListeners = [];
        this.websocketConnected = false;
        
        // Test state
        this.testState = {
            type: null,           // 'toefl' or 'ielts'
            mode: null,           // 'full' or 'practice'
            currentTask: 1,       // current task/part number
            totalTasks: 4,        // total tasks/parts
            phase: 'preparation', // 'preparation', 'response', 'completed'
            isRecording: false,
            recordings: [],
            scores: null,
            feedback: null,
            startTime: null,
            endTime: null
        };
        
        this.initializeStore();
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initializeStore() {
        console.log('📊 Initializing Session Store...');
        
        // Listen for auth changes
        auth.onAuthChange((event, user) => {
            if (event === 'authenticated') {
                this.loadUserSessions();
            } else if (event === 'unauthenticated') {
                this.clearSessions();
            }
        });
        
        // Setup WebSocket listeners
        this.setupWebSocketListeners();
        
        console.log('✅ Session Store initialized');
    }

    setupWebSocketListeners() {
        websocket.on('connected', (data) => {
            this.websocketConnected = true;
            this.notifyListeners('websocketConnected', data);
        });

        websocket.on('disconnected', (data) => {
            this.websocketConnected = false;
            this.notifyListeners('websocketDisconnected', data);
        });

        websocket.on('sessionUpdated', (data) => {
            this.handleSessionUpdate(data);
        });

        websocket.on('audioProcessed', (data) => {
            this.handleAudioProcessed(data);
        });

        websocket.on('transcription', (data) => {
            this.handleTranscription(data);
        });

        websocket.on('aiResponse', (data) => {
            this.handleAIResponse(data);
        });

        websocket.on('realTimeFeedback', (data) => {
            this.handleRealTimeFeedback(data);
        });
    }

    // ============================================================================
    // SESSION MANAGEMENT
    // ============================================================================

    async createSession(testType, mode = 'full', options = {}) {
        try {
            this.setLoading(true);
            this.clearError();
            
            if (!auth.isLoggedIn()) {
                throw new Error('Authentication required');
            }

            console.log(`📊 Creating ${testType.toUpperCase()} session (${mode})`);

            const sessionData = {
                test_type: testType,
                mode: mode,
                metadata: {
                    ...options,
                    user_agent: navigator.userAgent,
                    created_from: 'web_client',
                    client_version: '1.0.0'
                }
            };

            const result = await api.createSession(sessionData);

            if (result.success) {
                this.currentSession = result.session;
                
                // Update test state
                this.testState = {
                    ...this.testState,
                    type: testType,
                    mode: mode,
                    currentTask: 1,
                    totalTasks: testType === 'toefl' ? 4 : 3,
                    phase: 'preparation',
                    startTime: new Date(),
                    recordings: [],
                    scores: null,
                    feedback: null
                };

                // Connect WebSocket if available
                if (result.websocket_url && auth.getStoredToken()) {
                    try {
                        await websocket.connect(this.currentSession.id, auth.getStoredToken());
                        console.log('✅ WebSocket connected for session');
                    } catch (wsError) {
                        console.warn('⚠️ WebSocket connection failed:', wsError);
                        // Continue without WebSocket
                    }
                }

                this.notifyListeners('sessionCreated', this.currentSession);
                await this.loadUserSessions(); // Refresh session list

                console.log('✅ Session created successfully:', this.currentSession.id);
                return { success: true, session: this.currentSession };

            } else {
                throw new Error(result.error || 'Failed to create session');
            }

        } catch (error) {
            console.error('❌ Session creation failed:', error);
            this.setError(error.message);
            return { success: false, error: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    async loadUserSessions() {
        try {
            if (!auth.isLoggedIn()) {
                return;
            }

            const result = await api.getSessions();
            if (result.success) {
                this.sessions = result.sessions;
                this.notifyListeners('sessionsLoaded', this.sessions);
                console.log(`✅ Loaded ${this.sessions.length} user sessions`);
            }
        } catch (error) {
            console.error('❌ Failed to load sessions:', error);
        }
    }

    async getSessionStatus(sessionId) {
        try {
            const result = await api.getSessionStatus(sessionId);
            if (result.success) {
                return result.session;
            }
            return null;
        } catch (error) {
            console.error('❌ Failed to get session status:', error);
            return null;
        }
    }

    // ============================================================================
    // TEST FLOW MANAGEMENT
    // ============================================================================

    async startTest(testType, mode = 'full', taskNumber = null) {
        try {
            this.setLoading(true);

            // Create session if not exists
            if (!this.currentSession) {
                const result = await this.createSession(testType, mode);
                if (!result.success) {
                    throw new Error(result.error);
                }
            }

            // Start specific test/task
            let result;
            if (testType === 'toefl') {
                const task = taskNumber || this.testState.currentTask;
                result = await api.startTOEFLTask(this.currentSession.id, task);
            } else {
                const part = taskNumber || this.testState.currentTask;
                result = await api.startIELTSPart(this.currentSession.id, part);
            }

            if (result.success) {
                this.testState.phase = 'preparation';
                this.notifyListeners('testStarted', { testType, task: result.task || result.part });
                
                // Start conversation via WebSocket if connected
                if (this.websocketConnected) {
                    websocket.startConversation(testType, `task_${taskNumber || this.testState.currentTask}`);
                }

                return { success: true, data: result };
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('❌ Failed to start test:', error);
            this.setError(error.message);
            return { success: false, error: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    async submitResponse(audioFile, responseData = {}) {
        try {
            this.setLoading(true);

            if (!this.currentSession) {
                throw new Error('No active session');
            }

            console.log('📊 Submitting response for session:', this.currentSession.id);

            // Upload audio if provided
            let audioResult = null;
            if (audioFile) {
                audioResult = await api.uploadAudio(audioFile, this.currentSession.id, {
                    user_id: auth.getUserId(),
                    part_task: `${this.testState.type}_task_${this.testState.currentTask}`,
                    question_id: responseData.question_id
                });

                if (!audioResult.success) {
                    throw new Error('Audio upload failed: ' + audioResult.error);
                }
            }

            // Submit response to test endpoint
            const submitData = {
                ...responseData,
                audio_id: audioResult?.audio?.audio_id,
                transcription: audioResult?.audio?.transcription,
                response_time: responseData.response_time || Date.now() - this.testState.startTime,
                metadata: {
                    recording_duration: responseData.recording_duration,
                    audio_quality: audioResult?.audio?.quality_metrics
                }
            };

            let result;
            if (this.testState.type === 'toefl') {
                result = await api.submitTOEFLResponse(
                    this.currentSession.id,
                    this.testState.currentTask,
                    submitData
                );
            } else {
                result = await api.submitIELTSResponse(
                    this.currentSession.id,
                    this.testState.currentTask,
                    submitData
                );
            }

            if (result.success) {
                // Add recording to state
                this.testState.recordings.push({
                    task: this.testState.currentTask,
                    audioId: audioResult?.audio?.audio_id,
                    transcription: audioResult?.audio?.transcription,
                    duration: responseData.recording_duration,
                    timestamp: new Date()
                });

                this.notifyListeners('responseSubmitted', {
                    audio: audioResult?.audio,
                    result: result.result
                });

                return { success: true, audio: audioResult?.audio, result: result.result };
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('❌ Response submission failed:', error);
            this.setError(error.message);
            return { success: false, error: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    async nextTask() {
        if (this.testState.currentTask < this.testState.totalTasks) {
            this.testState.currentTask++;
            this.testState.phase = 'preparation';
            this.notifyListeners('taskChanged', {
                currentTask: this.testState.currentTask,
                totalTasks: this.testState.totalTasks
            });
            
            // Start next task
            return await this.startTest(this.testState.type, this.testState.mode, this.testState.currentTask);
        } else {
            return await this.completeTest();
        }
    }

    async completeTest() {
        try {
            this.setLoading(true);

            if (!this.currentSession) {
                throw new Error('No active session');
            }

            console.log('📊 Completing test session:', this.currentSession.id);

            // Get final scores
            let scoreResult;
            if (this.testState.type === 'toefl') {
                scoreResult = await api.getTOEFLScore(this.currentSession.id);
            } else {
                scoreResult = await api.getIELTSScore(this.currentSession.id);
            }

            if (scoreResult.success) {
                this.testState.scores = scoreResult.score;
                this.testState.phase = 'completed';
                this.testState.endTime = new Date();

                this.notifyListeners('testCompleted', {
                    scores: this.testState.scores,
                    recordings: this.testState.recordings,
                    duration: this.testState.endTime - this.testState.startTime
                });

                return { success: true, scores: this.testState.scores };
            } else {
                throw new Error(scoreResult.error);
            }

        } catch (error) {
            console.error('❌ Test completion failed:', error);
            this.setError(error.message);
            return { success: false, error: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    // ============================================================================
    // WEBSOCKET EVENT HANDLERS
    // ============================================================================

    handleSessionUpdate(data) {
        if (this.currentSession && data.session_id === this.currentSession.id) {
            console.log('📊 Session updated via WebSocket');
            this.notifyListeners('sessionUpdated', data);
        }
    }

    handleAudioProcessed(data) {
        console.log('📊 Audio processed:', data.chunk_id);
        this.notifyListeners('audioProcessed', data);
    }

    handleTranscription(data) {
        console.log('📊 Transcription received:', data.data?.text);
        this.notifyListeners('transcriptionReceived', data);
    }

    handleAIResponse(data) {
        console.log('📊 AI response received:', data.message);
        this.notifyListeners('aiResponseReceived', data);
    }

    handleRealTimeFeedback(data) {
        console.log('📊 Real-time feedback:', data.feedback);
        this.notifyListeners('realTimeFeedback', data);
    }

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    setLoading(loading) {
        this.isLoading = loading;
        this.notifyListeners('loadingChanged', loading);
    }

    setError(error) {
        this.error = error;
        this.notifyListeners('errorChanged', error);
    }

    clearError() {
        this.error = null;
        this.notifyListeners('errorChanged', null);
    }

    clearSessions() {
        this.sessions = [];
        this.currentSession = null;
        this.testState = {
            type: null,
            mode: null,
            currentTask: 1,
            totalTasks: 4,
            phase: 'preparation',
            isRecording: false,
            recordings: [],
            scores: null,
            feedback: null,
            startTime: null,
            endTime: null
        };
        this.notifyListeners('sessionsCleared');
    }

    // ============================================================================
    // EVENT SYSTEM
    // ============================================================================

    onSessionChange(callback) {
        this.sessionListeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.sessionListeners.indexOf(callback);
            if (index > -1) {
                this.sessionListeners.splice(index, 1);
            }
        };
    }

    notifyListeners(event, data = null) {
        this.sessionListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('❌ Session listener error:', error);
            }
        });
    }

    // ============================================================================
    // GETTERS
    // ============================================================================

    getCurrentSession() {
        return this.currentSession;
    }

    getTestState() {
        return { ...this.testState };
    }

    getSessions() {
        return [...this.sessions];
    }

    isSessionActive() {
        return this.currentSession !== null;
    }

    getSessionId() {
        return this.currentSession?.id;
    }

    getProgress() {
        if (!this.testState.totalTasks) return 0;
        return ((this.testState.currentTask - 1) / this.testState.totalTasks) * 100;
    }
}

// Create singleton instance
const sessionStore = new SessionStore();

// Export both the class and instance
export default sessionStore;
export { SessionStore }; 