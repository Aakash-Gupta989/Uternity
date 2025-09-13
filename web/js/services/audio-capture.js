/**
 * Real-time Audio Capture Service
 * Captures microphone audio and streams it to the backend for Whisper processing
 */

class AudioCaptureService {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.websocket = null;
        this.onTranscription = null;
        this.recordingStartTime = null;
        
        // Audio configuration
        this.config = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 16000,
            sampleRate: 16000, // Whisper optimal sample rate
            channelCount: 1, // Mono audio
            chunkDuration: 1000 // Send chunks every 1 second
        };
    }
    
    /**
     * Initialize audio capture with microphone access
     */
    async initialize() {
        try {
            console.log('🎤 Requesting microphone access...');
            
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.config.sampleRate,
                    channelCount: this.config.channelCount,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            console.log('✅ Microphone access granted');
            return true;
            
        } catch (error) {
            console.error('❌ Microphone access failed:', error);
            throw new Error(`Microphone access denied: ${error.message}`);
        }
    }
    
    /**
     * Set the WebSocket connection for streaming audio
     */
    setWebSocket(websocket) {
        this.websocket = websocket;
        console.log('🔗 WebSocket connected to audio capture service');
    }
    
    /**
     * Start real-time audio recording and streaming
     */
    async startRecording() {
        if (this.isRecording) {
            console.warn('⚠️ Already recording');
            return false;
        }
        
        if (!this.audioStream) {
            throw new Error('Audio stream not initialized. Call initialize() first.');
        }
        
        try {
            console.log('🎤 Starting audio recording...');
            
            // Reset chunks
            this.audioChunks = [];
            this.recordingStartTime = Date.now();
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            // Handle data available (audio chunks)
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.handleAudioChunk(event.data);
                }
            };
            
            // Start recording with time slicing
            this.mediaRecorder.start(this.config.chunkDuration);
            this.isRecording = true;
            
            console.log('✅ Audio recording started');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            throw error;
        }
    }
    
    /**
     * Stop audio recording
     */
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            return false;
        }
        
        console.log('🎤 Stopping audio recording...');
        this.mediaRecorder.stop();
        this.isRecording = false;
        return true;
    }
    
    /**
     * Handle individual audio chunks
     */
    async handleAudioChunk(audioBlob) {
        if (!this.websocket) {
            return;
        }
        
        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = this.arrayBufferToBase64(arrayBuffer);
            
            // Send audio chunk to backend for Whisper processing
            const message = {
                type: 'audio_chunk',
                session_id: 'current-session', // Will be set properly later
                data: {
                    audio: base64Audio,
                    timestamp: Date.now(),
                    format: audioBlob.type
                }
            };
            
            // Handle both WebSocket types
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify(message));
                console.log('📤 Audio chunk sent for transcription');
            } else if (this.websocket && typeof this.websocket.send === 'function') {
                this.websocket.send(message);
                console.log('📤 Audio chunk sent via wrapper');
            } else {
                console.warn('⚠️ WebSocket not ready for audio streaming');
            }
            
        } catch (error) {
            console.error('❌ Failed to process audio chunk:', error);
        }
    }
    
    /**
     * Convert ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.mediaRecorder && this.isRecording) {
            this.stopRecording();
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        console.log('🧹 Audio capture cleaned up');
    }
}

// Export for use in other modules
window.AudioCaptureService = AudioCaptureService;
