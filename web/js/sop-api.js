/**
 * SOP Assistant API Client
 * Handles all communication with the SOP Assistant backend
 */

const SOP_API_BASE_URL = '/chat';

class SOPAssistantAPI {
    constructor() {
        this.baseURL = SOP_API_BASE_URL;
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    /**
     * Make API request with error handling
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers
            }
        };

        try {
            console.log(`Making API request: ${config.method || 'GET'} ${url}`);
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.text();
                console.warn(`Backend unavailable (${response.status}): Using offline mode`);
                throw new Error(`Backend unavailable - using offline mode`);
            }

            return await response.json();
        } catch (error) {
            console.warn('Backend not available, using offline mode:', error.message);
            throw error;
        }
    }

    // =====================================
    // SESSION MANAGEMENT
    // =====================================

    /**
     * Get all sessions for a user
     */
    async getSessions(userId = 'default-user') {
        return await this.makeRequest(`/sessions/?user_id=${userId}`);
    }

    /**
     * Create a new SOP session
     */
    async createSession(sessionData) {
        return await this.makeRequest('/sessions/', {
            method: 'POST',
            body: JSON.stringify({
                title: sessionData.title || 'New SOP Session',
                description: sessionData.description || '',
                user_id: sessionData.user_id || 'default-user',
                target_program: sessionData.target_program || '',
                field_of_study: sessionData.field_of_study || '',
                academic_level: sessionData.academic_level || 'GRADUATE',
                target_universities: sessionData.target_universities || [],
                preferences: sessionData.preferences || {}
            })
        });
    }

    /**
     * Get a specific session
     */
    async getSession(sessionId) {
        return await this.makeRequest(`/sessions/${sessionId}`);
    }

    /**
     * Update session
     */
    async updateSession(sessionId, updateData) {
        return await this.makeRequest(`/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    /**
     * Delete session
     */
    async deleteSession(sessionId) {
        return await this.makeRequest(`/sessions/${sessionId}`, {
            method: 'DELETE'
        });
    }

    // =====================================
    // AI ASSISTANT & CONVERSATIONS
    // =====================================

    /**
     * Start a conversation with the AI assistant
     */
    async startConversation(sessionId, message) {
        return await this.makeRequest('/assistant/chat', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                message: message,
                message_type: 'USER'
            })
        });
    }

    /**
     * Continue conversation
     */
    async sendMessage(sessionId, message, messageType = 'USER') {
        return await this.makeRequest('/assistant/chat', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                message: message,
                message_type: messageType
            })
        });
    }

    /**
     * Get conversation history
     */
    async getConversationHistory(sessionId) {
        return await this.makeRequest(`/assistant/history/${sessionId}`);
    }

    /**
     * Get next question from AI
     */
    async getNextQuestion(sessionId, currentSection = null) {
        return await this.makeRequest('/assistant/next-question', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                current_section: currentSection
            })
        });
    }

    /**
     * Get AI follow-up question based on user response
     */
    async getFollowUpQuestion(userResponse, context = null, previousQuestion = null, section = null) {
        const payload = {
            user_response: userResponse,
            context: context,
            previous_question: previousQuestion
        };
        if (section) payload.section = section;
        return await this.makeRequest('/assistant/follow-up-question', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    /**
     * Get an initial question for a specific section
     */
    async getSectionQuestions(section, fieldOfStudy = null, context = {}) {
        return await this.makeRequest('/assistant/section-questions', {
            method: 'POST',
            body: JSON.stringify({
                section,
                field_of_study: fieldOfStudy,
                context
            })
        });
    }

    /**
     * Generate a complete SOP draft from saved section stories
     */
    async generateDraft(userStories, fieldOfStudy = null, targetUniversity = null, targetProgram = null, wordLimit = 800) {
        return await this.makeRequest('/assistant/generate-draft', {
            method: 'POST',
            body: JSON.stringify({
                user_stories: userStories,
                field_of_study: fieldOfStudy,
                target_university: targetUniversity,
                target_program: targetProgram,
                word_limit: wordLimit
            })
        });
    }

    /**
     * Export a draft SOP directly by content
     */
    async exportDraft(draftContent, format = 'pdf', universityName = '', targetDegree = 'Graduate Program') {
        const url = `${this.baseURL}/assistant/export-sop`;
        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                draft_content: draftContent,
                format,
                university_name: universityName,
                target_degree: targetDegree
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Export failed: ${err}`);
        }

        return await response.blob();
    }

    // =====================================
    // SECTION MANAGEMENT
    // =====================================

    /**
     * Create a new section
     */
    async createSection(sessionId, sectionData) {
        return await this.makeRequest(`/sections/?session_id=${sessionId}`, {
            method: 'POST',
            body: JSON.stringify(sectionData)
        });
    }

    /**
     * Get all sections for a session
     */
    async getSections(sessionId) {
        return await this.makeRequest(`/sections/${sessionId}`);
    }

    /**
     * Update section content
     */
    async updateSection(sectionId, content) {
        return await this.makeRequest(`/sections/${sectionId}`, {
            method: 'PUT',
            body: JSON.stringify({
                content: content.raw_content || '',
                status: content.status || 'DRAFT',
                metadata: {
                    structured_content: content.structured_content || {},
                    generated_draft: content.generated_draft || '',
                    final_content: content.final_content || ''
                }
            })
        });
    }

    /**
     * Update section content specifically
     */
    async updateSectionContent(sectionId, content) {
        return await this.makeRequest(`/sections/${sectionId}/content`, {
            method: 'PATCH',
            body: JSON.stringify({
                content: content
            })
        });
    }

    /**
     * Generate section draft
     */
    async generateSectionDraft(sessionId, sectionType) {
        return await this.makeRequest('/sections/generate-draft', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                section_type: sectionType
            })
        });
    }

    /**
     * Generate AI content for a section (stateless)
     * Uses backend endpoint: POST /assistant/generate-section
     */
    async generateSectionContent(section, storyText, fieldOfStudy = null, targetUniversity = null, targetProgram = null) {
        return await this.makeRequest(`/assistant/generate-section`, {
            method: 'POST',
            body: JSON.stringify({
                section: section,
                story_text: storyText,
                field_of_study: fieldOfStudy,
                target_university: targetUniversity,
                target_program: targetProgram
            })
        });
    }

    // =====================================
    // UNIVERSITY INTEGRATION
    // =====================================

    /**
     * Search universities
     */
    async searchUniversities(query) {
        return await this.makeRequest(`/universities/search?q=${encodeURIComponent(query)}`);
    }

    /**
     * Get university details
     */
    async getUniversity(universityId) {
        return await this.makeRequest(`/universities/${universityId}`);
    }

    /**
     * Get university programs
     */
    async getUniversityPrograms(universityId, fieldOfStudy = null) {
        const queryParam = fieldOfStudy ? `?field_of_study=${encodeURIComponent(fieldOfStudy)}` : '';
        return await this.makeRequest(`/universities/${universityId}/programs${queryParam}`);
    }

    // =====================================
    // EXPORT FUNCTIONALITY
    // =====================================

    /**
     * Export SOP in various formats
     */
    async exportSOP(sessionId, format = 'pdf', includeMetadata = true) {
        const response = await fetch(`${this.baseURL}/export/${sessionId}?format=${format}&include_metadata=${includeMetadata}`, {
            method: 'GET',
            headers: this.headers
        });

        if (!response.ok) {
            throw new Error(`Export failed: ${response.statusText}`);
        }

        return response.blob();
    }

    // =====================================
    // ANALYTICS & PROGRESS
    // =====================================

    /**
     * Get session analytics
     */
    async getSessionAnalytics(sessionId) {
        return await this.makeRequest(`/sessions/${sessionId}/analytics`);
    }

    /**
     * Get session progress summary
     */
    async getProgressSummary(sessionId) {
        return await this.makeRequest(`/sessions/${sessionId}/progress`);
    }

    // =====================================
    // STORY MANAGEMENT
    // =====================================

    /**
     * Save a story for future use
     */
    async saveStory(storyData) {
        return await this.makeRequest('/assistant/stories', {
            method: 'POST',
            body: JSON.stringify(storyData)
        });
    }

    /**
     * Get all saved stories
     */
    async getStories(filters = {}) {
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.field_of_study) params.append('field_of_study', filters.field_of_study);
        if (filters.bookmarked_only) params.append('bookmarked_only', 'true');
        
        const queryString = params.toString();
        return await this.makeRequest(`/assistant/stories${queryString ? '?' + queryString : ''}`);
    }

    /**
     * Toggle bookmark status of a story
     */
    async toggleStoryBookmark(storyId) {
        return await this.makeRequest(`/assistant/stories/${storyId}/bookmark`, {
            method: 'PUT'
        });
    }

    // =====================================
    // ENHANCED CONVERSATION FLOW
    // =====================================

    /**
     * Start an enhanced conversation with story exploration
     */
    async startEnhancedConversation(sessionId, hasStory, initialStory = null, fieldOfStudy = null, targetProgram = null) {
        return await this.makeRequest('/assistant/conversation/start', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                user_has_story: hasStory,
                initial_story: initialStory,
                field_of_study: fieldOfStudy,
                target_program: targetProgram,
                context: {}
            })
        });
    }

    /**
     * Continue the enhanced conversation flow
     */
    async continueEnhancedConversation(sessionId, userResponse, currentPhase, step, context = {}) {
        const requestData = {
            session_id: sessionId,
            user_response: userResponse,
            current_phase: currentPhase,
            step: step,
            context: context
        };
        
        console.log('🚀 Sending continue conversation request:', requestData);
        
        return await this.makeRequest('/assistant/conversation/continue', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    }

    // =====================================
    // HEALTH CHECK
    // =====================================

    /**
     * Check API health
     */
    async checkHealth() {
        // Health endpoint is at root level, not under /api/v1
        const response = await fetch('/health');
        if (!response.ok) {
            throw new Error(`Health check failed: ${response.statusText}`);
        }
        return await response.json();
    }

    /**
     * Validate session ID format
     */
    isValidSessionId(sessionId) {
        return sessionId && typeof sessionId === 'string' && sessionId.length > 0;
    }
}

// Create and export a singleton instance
const sopAPI = new SOPAssistantAPI();

// Make it available globally
if (typeof window !== 'undefined') {
    window.sopAPI = sopAPI;
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = sopAPI;
} 