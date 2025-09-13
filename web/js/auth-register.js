/**
 * UTERNITY Register Page Integration
 * Handles registration form submission and user account creation
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
                    console.log('authAPI loaded on retry, initializing registration');
                    initializeRegistration();
                } else {
                    console.error('authAPI still not available after retry');
                }
            }, 500);
        } else {
            console.log('authAPI available, initializing registration');
            initializeRegistration();
        }
    }, 100);
});

function initializeRegistration() {
    const registerForm = document.getElementById('registerForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const termsCheckbox = document.getElementById('terms');
    const privacyCheckbox = null; // Not present in this form
    const marketingCheckbox = null; // Not present in this form
    const passwordToggles = document.querySelectorAll('.password-toggle');
    const submitButton = registerForm ? (
        registerForm.querySelector('button[type="submit"]') || 
        registerForm.querySelector('.btn-primary') ||
        registerForm.querySelector('button')
    ) : null;
    const socialButtons = document.querySelectorAll('.social-btn');
    const messageContainer = document.getElementById('message') || document.querySelector('.auth-container') || document.body;
    
    // Debug logging
    console.log('Auth-register initialized:');
    console.log('- registerForm:', registerForm);
    console.log('- submitButton:', submitButton);
    console.log('- messageContainer:', messageContainer);
    console.log('- termsCheckbox:', termsCheckbox);
    console.log('- privacyCheckbox:', privacyCheckbox);
    console.log('- marketingCheckbox:', marketingCheckbox);
    const passwordStrength = document.querySelector('.password-strength');
    
    // Check if user is already authenticated
    if (window.authAPI && window.authAPI.isAuthenticated()) {
        // Use auth guard for proper redirection
        if (window.authGuard) {
            window.authGuard.redirectToDashboard();
                } else {
            window.location.href = '/app/dashboard.html';
        }
        return;
    }
    
    // Form validation
    function validateForm() {
        // Clear previous errors
        clearFieldErrors();
        
        let isValid = true;
        
        // Full name validation
        const fullName = fullNameInput.value.trim();
        if (!fullName) {
            showFieldError(fullNameInput, 'Full name is required');
            isValid = false;
        } else if (fullName.length < 2) {
            showFieldError(fullNameInput, 'Full name must be at least 2 characters');
            isValid = false;
        } else if (!fullName.includes(' ')) {
            showFieldError(fullNameInput, 'Please enter both first and last name');
            isValid = false;
        }
        
        // Email validation
        const email = emailInput.value.trim();
        if (!email) {
            showFieldError(emailInput, 'Email is required');
            isValid = false;
        } else if (!AuthUIHelpers.isValidEmail(email)) {
            showFieldError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }
        
        // Note: Phone, country, and university fields are optional and not in this form
        
        // Password validation
        const password = passwordInput.value;
        const passwordValidation = AuthUIHelpers.validatePassword(password);
        if (!password) {
            showFieldError(passwordInput, 'Password is required');
            isValid = false;
        } else if (!passwordValidation.isValid) {
            showFieldError(passwordInput, 'Password must meet all security requirements');
            isValid = false;
        }
        
        // Confirm password validation
        const confirmPassword = confirmPasswordInput.value;
        if (!confirmPassword) {
            showFieldError(confirmPasswordInput, 'Please confirm your password');
            isValid = false;
        } else if (password !== confirmPassword) {
            showFieldError(confirmPasswordInput, 'Passwords do not match');
            isValid = false;
        }
        
        // Terms validation (includes both terms and privacy in this form)
        if (termsCheckbox && !termsCheckbox.checked) {
            showFieldError(termsCheckbox, 'You must accept the Terms of Service and Privacy Policy');
            isValid = false;
        }
        
        return isValid;
    }
    
    // Show field error
    function showFieldError(field, message) {
        field.classList.add('error');
        
        // For checkboxes, add error to the parent container
        const targetElement = field.type === 'checkbox' ? field.closest('.checkbox-group') : field.parentNode;
        
        // Remove existing error message
        const existingError = targetElement.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        targetElement.appendChild(errorElement);
    }
    
    // Clear field errors
    function clearFieldErrors() {
        document.querySelectorAll('.form-group input, .checkbox-group input').forEach(input => {
            input.classList.remove('error');
        });
        document.querySelectorAll('.field-error').forEach(error => {
            error.remove();
        });
    }
    
    // Password toggle functionality (handled by inline HTML onclick for this form)
    
    // Password strength indicator
    function updatePasswordStrength(password) {
        if (!passwordStrength) return;
        
        const validation = AuthUIHelpers.validatePassword(password);
        const strengthBar = passwordStrength.querySelector('.strength-bar');
        const strengthText = passwordStrength.querySelector('.strength-text');
        const requirements = passwordStrength.querySelector('.requirements');
        
        // Update strength bar
        if (strengthBar) {
            strengthBar.className = `strength-bar ${validation.strength}`;
            strengthBar.style.width = `${(validation.score / 5) * 100}%`;
        }
        
        // Update strength text
        if (strengthText) {
            const strengthLabels = {
                weak: 'Weak',
                medium: 'Medium', 
                strong: 'Strong'
            };
            strengthText.textContent = password ? strengthLabels[validation.strength] : '';
            strengthText.className = `strength-text ${validation.strength}`;
        }
        
        // Update requirements
        if (requirements) {
            const requirementItems = requirements.querySelectorAll('.requirement');
            requirementItems.forEach(item => {
                const check = item.dataset.check;
                const isValid = validation.checks[check];
                item.classList.toggle('valid', isValid);
                const icon = item.querySelector('.requirement-icon');
                if (icon) {
                    icon.textContent = isValid ? '✓' : '○';
                }
            });
        }
    }
    
    // Password input event
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            updatePasswordStrength(this.value);
            
            // Clear error if password becomes valid
            if (this.classList.contains('error')) {
                const validation = AuthUIHelpers.validatePassword(this.value);
                if (validation.isValid) {
                    this.classList.remove('error');
                    const error = this.parentNode.querySelector('.field-error');
                    if (error) error.remove();
                }
            }
        });
    }
    
    // Confirm password validation
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            if (this.classList.contains('error') && this.value === passwordInput.value) {
                this.classList.remove('error');
                const error = this.parentNode.querySelector('.field-error');
                if (error) error.remove();
            }
        });
    }
    
    // Handle registration form submission
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!validateForm()) {
                return;
            }
            
            // Split full name into first and last name
            const fullName = fullNameInput.value.trim();
            const nameParts = fullName.split(' ');
            const first_name = nameParts[0] || '';
            const last_name = nameParts.slice(1).join(' ') || '';
            
            const formData = {
                email: emailInput.value.trim(),
                password: passwordInput.value,
                first_name: first_name,
                last_name: last_name,
                terms_accepted: termsCheckbox ? termsCheckbox.checked : true,
                privacy_accepted: termsCheckbox ? termsCheckbox.checked : true,
                marketing_emails: false
            };
            
            try {
                console.log('Starting registration process...', formData);
                
                // Show loading state
                if (typeof AuthUIHelpers !== 'undefined' && AuthUIHelpers.showLoading) {
                    AuthUIHelpers.showLoading(submitButton, 'Creating account...');
                } else {
                    console.log('AuthUIHelpers not available, using basic loading');
                    submitButton.textContent = 'Creating account...';
                    submitButton.disabled = true;
                }
                
                // Attempt registration
                if (!window.authAPI) {
                    throw new Error('Auth API not available. Please refresh the page and try again.');
                }
                
                if (typeof window.authAPI.register !== 'function') {
                    throw new Error('Registration service not available. Please refresh the page and try again.');
                }
                
                console.log('Calling authAPI.register with:', formData);
                const response = await window.authAPI.register(formData);
                console.log('Registration response:', response);
                
                // Show success message
                if (typeof AuthUIHelpers !== 'undefined' && AuthUIHelpers.showSuccess) {
                    AuthUIHelpers.showSuccess(
                        messageContainer, 
                        'Account created successfully! Redirecting to your dashboard...'
                    );
                } else {
                    // Fallback to basic showMessage function
                    if (typeof showMessage === 'function') {
                        showMessage('Account created successfully! Redirecting to your dashboard...', 'success');
                    } else {
                        alert('Account created successfully!');
                    }
                }
                
                // Redirect after short delay
                setTimeout(() => {
                    // Use auth guard for proper redirection
                    if (window.authGuard) {
                        window.authGuard.redirectToDashboard();
                    } else {
                        window.location.href = '/pages/app/dashboard.html';
                    }
                }, 2000);
                
            } catch (error) {
                console.error('Registration error:', error);
                
                let errorMessage = 'Registration failed. Please try again.';
                
                if (error && typeof error === 'object') {
                    if (error.message) {
                        errorMessage = error.message;
                    }
                    
                    // Try to extract more specific error info
                    if (error.status === 400) {
                        if (error.message && error.message.includes('already registered')) {
                            errorMessage = 'This email address is already registered. Please use a different email or try logging in.';
                        }
                    }
                }
                
                console.log('Showing error message:', errorMessage);
                
                // Show error message
                if (typeof AuthUIHelpers !== 'undefined' && AuthUIHelpers.showError) {
                    AuthUIHelpers.showError(messageContainer, errorMessage);
                } else {
                    // Fallback to basic showMessage function
                    if (typeof showMessage === 'function') {
                        showMessage(errorMessage, 'error');
                    } else {
                        alert('Error: ' + errorMessage);
                    }
                }
                
            } finally {
                // Hide loading state
                if (typeof AuthUIHelpers !== 'undefined' && AuthUIHelpers.hideLoading) {
                    AuthUIHelpers.hideLoading(submitButton);
                } else {
                    console.log('Restoring button state');
                    submitButton.textContent = 'Create Account';
                    submitButton.disabled = false;
                }
            }
        });
    }
    
    // Handle social registration buttons
    socialButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const provider = this.dataset.provider;
            
            // Show coming soon message for social registration
            AuthUIHelpers.showError(
                messageContainer, 
                `${provider} registration will be available soon!`,
                3000
            );
        });
    });
    
    // Real-time validation
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
    
    fullNameInput.addEventListener('input', function() {
        if (this.classList.contains('error') && this.value.trim().length >= 2) {
            this.classList.remove('error');
            const error = this.parentNode.querySelector('.field-error');
            if (error) error.remove();
        }
    });
    
    // Checkbox validation
    [termsCheckbox, privacyCheckbox].filter(checkbox => checkbox !== null).forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.classList.contains('error') && this.checked) {
                this.classList.remove('error');
                const error = this.closest('.checkbox-group').querySelector('.field-error');
                if (error) error.remove();
            }
        });
    });
    
    // Auto-focus full name field
    if (fullNameInput) {
        fullNameInput.focus();
    }
    
    // Handle enter key navigation
    const inputs = [fullNameInput, emailInput, passwordInput, confirmPasswordInput];
    
    inputs.forEach((input, index) => {
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextInput = inputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                    } else {
                        // If it's the last input, submit the form
                        registerForm.dispatchEvent(new Event('submit'));
                    }
                }
            });
        }
    });
}

// Add CSS for registration-specific styles
const style = document.createElement('style');
style.textContent = `
    .form-group input.error,
    .checkbox-group input.error {
        border-color: #ff6b6b !important;
        box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.2) !important;
    }
    
    .checkbox-group.error label {
        color: #ff6b6b;
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
    
    .password-strength {
        margin-top: 0.75rem;
    }
    
    .strength-bar {
        height: 4px;
        border-radius: 2px;
        transition: all 0.3s ease;
        margin-bottom: 0.5rem;
    }
    
    .strength-bar.weak {
        background-color: #ff6b6b;
    }
    
    .strength-bar.medium {
        background-color: #fbbf24;
    }
    
    .strength-bar.strong {
        background-color: #22c55e;
    }
    
    .strength-text {
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
    }
    
    .strength-text.weak {
        color: #ff6b6b;
    }
    
    .strength-text.medium {
        color: #fbbf24;
    }
    
    .strength-text.strong {
        color: #22c55e;
    }
    
    .requirements {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.25rem;
        font-size: 0.875rem;
    }
    
    .requirement {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #6b7280;
        transition: color 0.3s ease;
    }
    
    .requirement.valid {
        color: #22c55e;
    }
    
    .requirement-icon {
        font-size: 0.75rem;
        width: 1rem;
        text-align: center;
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