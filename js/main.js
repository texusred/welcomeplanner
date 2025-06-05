// Cambridge Stall Planner - Main JavaScript

/**
 * Navigation handler for area cards
 * @param {string} area - The area identifier (ruskin, science, lab)
 */
function navigateToArea(area) {
    // Add loading animation
    const card = event.currentTarget;
    card.style.transform = 'scale(0.95)';
    card.style.opacity = '0.8';
    
    setTimeout(() => {
        // Navigate to the appropriate area page
        switch(area) {
            case 'ruskin':
                window.location.href = 'ruskin-courtyard.html';
                break;
            case 'science':
                window.location.href = 'science-walkway.html';
                break;
            case 'lab':
                window.location.href = 'lab-courtyard.html';
                break;
            default:
                console.error('Unknown area:', area);
        }
    }, 200);
}

/**
 * Enhanced interactive hover effects for area cards
 */
function initializeInteractiveEffects() {
    document.querySelectorAll('.area-card').forEach(card => {
        // Enhanced hover effect
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });

        // Add ripple effect on click
        card.addEventListener('click', function(e) {
            createRippleEffect(e, this);
        });
    });
}

/**
 * Create ripple effect on card click
 * @param {Event} e - Click event
 * @param {Element} element - Target element
 */
function createRippleEffect(e, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
        z-index: 1000;
    `;
    
    // Add ripple animation keyframes if not already added
    if (!document.querySelector('#ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    element.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
        if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
        }
    }, 600);
}

/**
 * Initialize stats counter animation
 */
function initializeStatsAnimation() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const finalValue = target.textContent;
                
                // Only animate numeric values
                if (!isNaN(finalValue)) {
                    animateCounter(target, 0, parseInt(finalValue), 1000);
                }
                
                observer.unobserve(target);
            }
        });
    });
    
    statNumbers.forEach(stat => observer.observe(stat));
}

/**
 * Animate counter from start to end value
 * @param {Element} element - Target element
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} duration - Animation duration in ms
 */
function animateCounter(element, start, end, duration) {
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.round(start + (end - start) * easeOutCubic(progress));
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

/**
 * Easing function for smooth animations
 * @param {number} t - Progress (0-1)
 * @returns {number} Eased progress
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Handle keyboard navigation
 */
function initializeKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        const cards = document.querySelectorAll('.area-card');
        const focusedCard = document.activeElement;
        const currentIndex = Array.from(cards).indexOf(focusedCard);
        
        switch(e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % cards.length;
                cards[nextIndex].focus();
                break;
                
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex === -1 ? cards.length - 1 : 
                                 (currentIndex - 1 + cards.length) % cards.length;
                cards[prevIndex].focus();
                break;
                
            case 'Enter':
            case ' ':
                if (focusedCard && focusedCard.classList.contains('area-card')) {
                    e.preventDefault();
                    focusedCard.click();
                }
                break;
        }
    });
    
    // Make cards focusable
    document.querySelectorAll('.area-card').forEach((card, index) => {
        card.setAttribute('tabindex', index === 0 ? '0' : '-1');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Navigate to ${card.querySelector('.area-title').textContent}`);
    });
}

/**
 * Handle loading state and page transitions
 */
function initializePageTransitions() {
    // Add loading completed class after page load
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
        
        // Stagger card animations
        const cards = document.querySelectorAll('.area-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.animationDelay = `${index * 0.1}s`;
                card.classList.add('animate-in');
            }, index * 100);
        });
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Pause animations when page is hidden
            document.body.classList.add('paused');
        } else {
            // Resume animations when page is visible
            document.body.classList.remove('paused');
        }
    });
}

/**
 * Initialize error handling
 */
function initializeErrorHandling() {
    window.addEventListener('error', function(e) {
        console.error('JavaScript error:', e.error);
        
        // Show user-friendly error message if navigation fails
        if (e.error && e.error.message.includes('navigation')) {
            showErrorMessage('Navigation failed. Please check that all pages exist.');
        }
    });
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3';
    errorDiv.style.zIndex = '9999';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>
        ${message}
        <button type="button" class="btn-close ms-2" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

/**
 * Initialize all functionality when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeInteractiveEffects();
    initializeStatsAnimation();
    initializeKeyboardNavigation();
    initializePageTransitions();
    initializeErrorHandling();
    
    console.log('Cambridge Stall Planner initialized successfully');
});