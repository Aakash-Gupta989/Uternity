/**
 * UTERNITY Login Page Integration
 * Handles login form submission and user authentication
 */

document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment for all scripts to load, then initialize
    setTimeout(() => {
        // Check if required dependencies are available
        if (typeof window.authAPI === 'undefined') {
            console.error('authAPI not loaded, waiting...');
            // Try again after a short delay
            setTimeout(() => {
                if (typeof window.authAPI !== 'undefined') {
                    console.log('authAPI loaded on retry, initializing login');
                    initializeLogin();
                } else {
                    console.error('authAPI still not available after retry');
                }
            }, 500);
        } else {
            console.log('authAPI available, initializing login');
            initializeLogin();
        }
    }, 100);
});

function initializeLogin() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const passwordToggle = document.querySelector('.password-toggle');
    const submitButton = document.querySelector('.submit-btn');
    const socialButtons = document.querySelectorAll('.social-btn');
    const messageContainer = document.getElementById('message') || document.querySelector('.auth-card') || document.querySelector('.auth-container') || document.body;
    
    // Check if user is already authenticated
    if (window.authAPI && window.authAPI.isAuthenticated()) {
        // Use auth guard for proper redirection
        if (window.authGuard) {
            window.authGuard.redirectToDashboard();
                } else {
            window.location.href = '/pages/app/dashboard.html';
        }
        return;
    }
    
    // Form validation
    function validateForm() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        // Clear previous errors
        clearFieldErrors();
        
        let isValid = true;
        
        // Email validation
        if (!email) {
            showFieldError(emailInput, 'Email is required');
            isValid = false;
        } else if (!AuthUIHelpers.isValidEmail(email)) {
            showFieldError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }
        
        // Password validation
        if (!password) {
            showFieldError(passwordInput, 'Password is required');
            isValid = false;
        } else if (password.length < 8) {
            showFieldError(passwordInput, 'Password must be at least 8 characters');
            isValid = false;
        }
        
        return isValid;
    }
    
    // Show field error
    function showFieldError(field, message) {
        field.classList.add('error');
        
        // Remove existing error message
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        field.parentNode.appendChild(errorElement);
    }
    
    // Clear field errors
    function clearFieldErrors() {
        document.querySelectorAll('.form-group input').forEach(input => {
            input.classList.remove('error');
        });
        document.querySelectorAll('.field-error').forEach(error => {
            error.remove();
        });
    }
    
    // Password toggle functionality
    if (passwordToggle) {
        passwordToggle.addEventListener('click', function() {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            this.textContent = isPassword ? '👁️' : '🙈';
        });
    }
    
    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!validateForm()) {
                return;
            }
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
            
            try {
                // Show loading state
                AuthUIHelpers.showLoading(submitButton, 'Signing in...');
                
                // Get device info for session tracking
                const deviceInfo = {
                    platform: navigator.platform,
                    userAgent: navigator.userAgent,
                    screen: `${screen.width}x${screen.height}`,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language
                };
                
                // Attempt login
                const response = await window.authAPI.login({
                    email: email,
                    password: password,
                    remember_me: rememberMe,
                    device_info: deviceInfo
                });
                
                // Show success message
                AuthUIHelpers.showSuccess(messageContainer, 'Login successful! Redirecting...');
                
                console.log('🚀 Login successful, preparing redirect...');
                console.log('📍 Current location:', window.location.href);
                console.log('🔒 AuthGuard available:', !!window.authGuard);
                console.log('🔐 AuthAPI available:', !!window.authAPI);
                console.log('✅ Is authenticated:', window.authAPI ? window.authAPI.isAuthenticated() : 'Unknown');
                
                // Redirect after shorter delay to prevent issues
                setTimeout(() => {
                    try {
                        console.log('⏰ Starting redirect process...');
                        
                        // Simple direct redirect to dashboard
                        const dashboardUrl = '/pages/app/dashboard.html';
                        console.log('🎯 Redirecting directly to:', dashboardUrl);
                        
                        // Force redirect
                        window.location.replace(dashboardUrl);
                        
                    } catch (error) {
                        console.error('❌ Redirect failed:', error);
                        // Emergency fallback with assign instead of replace
                        console.log('🆘 Emergency redirect with location.assign');
                        try {
                            window.location.assign('/pages/app/dashboard.html');
                        } catch (assignError) {
                            console.error('❌ Assign also failed:', assignError);
                            // Last resort
                            window.location.href = '/pages/app/dashboard.html';
                        }
                    }
                }, 800);
                
            } catch (error) {
                console.error('Login error:', error);
                
                let errorMessage = 'Login failed. Please try again.';
                
                if (error instanceof AuthAPIError) {
                    if (error.isUnauthorized()) {
                        errorMessage = 'Invalid email or password. Please check your credentials.';
                    } else if (error.isRateLimited()) {
                        errorMessage = 'Too many login attempts. Please try again later.';
                    } else if (error.status === 423) {
                        errorMessage = 'Your account is locked due to too many failed attempts. Please contact support.';
                    } else if (error.isValidationError()) {
                        errorMessage = 'Please check your input and try again.';
                    } else {
                        errorMessage = error.message || errorMessage;
                    }
                }
                
                AuthUIHelpers.showError(messageContainer, errorMessage);
                
            } finally {
                // Hide loading state
                AuthUIHelpers.hideLoading(submitButton);
            }
        });
    }
    
    // Handle social login buttons
    socialButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const provider = this.dataset.provider;
            
            // Show coming soon message for social login
            AuthUIHelpers.showError(
                messageContainer, 
                `${provider} login will be available soon!`,
                3000
            );
        });
    });
    
    // Real-time form validation
    emailInput.addEventListener('blur', function() {
        const email = this.value.trim();
        if (email && !AuthUIHelpers.isValidEmail(email)) {
            showFieldError(this, 'Please enter a valid email address');
        } else {
            this.classList.remove('error');
            const error = this.parentNode.querySelector('.field-error');
            if (error) error.remove();
        }
    });
    
    passwordInput.addEventListener('input', function() {
        if (this.classList.contains('error') && this.value.length >= 8) {
            this.classList.remove('error');
            const error = this.parentNode.querySelector('.field-error');
            if (error) error.remove();
        }
    });
    
    // Handle forgot password link
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            handleForgotPassword();
        });
    }
    
    // Handle forgot password
    async function handleForgotPassword() {
        const email = emailInput.value.trim();
        
        if (!email) {
            AuthUIHelpers.showError(messageContainer, 'Please enter your email address first.');
            emailInput.focus();
            return;
        }
        
        if (!AuthUIHelpers.isValidEmail(email)) {
            AuthUIHelpers.showError(messageContainer, 'Please enter a valid email address.');
            emailInput.focus();
            return;
        }
        
        try {
            // Show loading state
            const originalText = forgotPasswordLink.textContent;
            forgotPasswordLink.textContent = 'Sending...';
            forgotPasswordLink.style.pointerEvents = 'none';
            
            await window.authAPI.forgotPassword(email);
            
            AuthUIHelpers.showSuccess(
                messageContainer, 
                'Password reset instructions have been sent to your email.'
            );
            
        } catch (error) {
            console.error('Forgot password error:', error);
            
            let errorMessage = 'Failed to send password reset email. Please try again.';
            
            if (error instanceof AuthAPIError) {
                if (error.isRateLimited()) {
                    errorMessage = 'Too many password reset requests. Please try again later.';
                } else {
                    errorMessage = error.message || errorMessage;
                }
            }
            
            AuthUIHelpers.showError(messageContainer, errorMessage);
            
        } finally {
            // Reset link state
            forgotPasswordLink.textContent = 'Forgot Password?';
            forgotPasswordLink.style.pointerEvents = 'auto';
        }
    }
    
    // Auto-focus email field
    if (emailInput) {
        emailInput.focus();
    }
    
    // Handle enter key in email field
    emailInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            passwordInput.focus();
        }
    });
    
    // Handle enter key in password field
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
}

// Add CSS for error states and messages
const style = document.createElement('style');
style.textContent = `
    .form-group input.error {
        border-color: #ff6b6b !important;
        box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.2) !important;
    }
    
    .field-error {
        color: #ff6b6b;
        font-size: 0.875rem;
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .field-error::before {
        content: "⚠️";
        font-size: 0.875rem;
    }
    
    .error-message {
        background: rgba(255, 107, 107, 0.1);
        border: 1px solid rgba(255, 107, 107, 0.3);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1.5rem;
        animation: slideIn 0.3s ease-out;
    }
    
    .error-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }
    
    .error-content span {
        color: #ff6b6b;
        font-weight: 500;
    }
    
    .error-close {
        background: none;
        border: none;
        color: #ff6b6b;
        cursor: pointer;
        font-size: 1.25rem;
        padding: 0;
        line-height: 1;
    }
    
    .success-message {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1.5rem;
        animation: slideIn 0.3s ease-out;
    }
    
    .success-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .success-content span {
        color: #22c55e;
        font-weight: 500;
    }
    
    .spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: currentColor;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-right: 0.5rem;
    }
    
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
    
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

document.head.appendChild(style); 