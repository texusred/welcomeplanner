// Cambridge Stall Planner - Mobile-First Main JavaScript

// Global state
let currentCardIndex = 0;
let isSwipeTransitioning = false;
let deferredPrompt = null;
let swipeStartX = 0;
let swipeStartY = 0;
let isSwiping = false;

// Area data
const areas = [
    { id: 'ruskin', name: 'Ruskin Courtyard', url: 'ruskin-courtyard.html' },
    { id: 'science', name: 'Science Walkway', url: 'science-walkway.html' },
    { id: 'lab', name: 'LAB Courtyard', url: 'lab-courtyard.html' }
];

/**
 * Navigation handler for area cards with mobile optimization
 */
function navigateToArea(area) {
    // Add haptic feedback
    if (window.TouchUtils && window.MobileDevice?.isMobile) {
        window.TouchUtils.hapticFeedback('light');
    }
    
    // Add loading animation
    const card = event.currentTarget;
    
    // Mobile: Scale down slightly
    if (window.MobileDevice?.isMobile) {
        card.style.transform = 'scale(0.98)';
        card.style.opacity = '0.9';
    } else {
        // Desktop: Current behavior
        card.style.transform = 'scale(0.95)';
        card.style.opacity = '0.8';
    }
    
    // Store navigation history
    if (window.NavigationUtils) {
        window.NavigationUtils.history.push('home');
    }
    
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
    }, window.MobileDevice?.isMobile ? 100 : 200);
}

/**
 * Initialize mobile-specific functionality
 */
function initializeMobileFeatures() {
    if (!window.MobileDevice?.isMobile) return;
    
    console.log('[Mobile] Initializing mobile-specific features');
    
    // Initialize card swipe navigation
    initializeCardSwipeNavigation();
    
    // Initialize mobile gestures
    initializeMobileGestures();
    
    // Auto-advance cards (optional demo feature)
    // initializeAutoAdvance();
    
    console.log('[Mobile] Mobile features initialized');
}

/**
 * Initialize card swipe navigation for mobile
 */
function initializeCardSwipeNavigation() {
    const deck = document.getElementById('areasDeck');
    const cards = deck.querySelectorAll('.area-card');
    const indicators = document.querySelectorAll('.indicator');
    
    if (!deck || cards.length === 0) return;
    
    console.log('[Mobile] Initializing card swipe navigation');
    
    // Set initial active card
    updateActiveCard(0);
    
    // Touch events for swipe
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;
    let startTime = 0;
    
    // Optimized touch handlers
    const handleTouchStart = window.PerformanceUtils.throttle((e) => {
        if (isSwipeTransitioning) return;
        
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = startX;
        isDragging = false;
        startTime = Date.now();
        
        // Prevent card transition during touch
        deck.style.transition = 'none';
    }, 16);
    
    const handleTouchMove = window.PerformanceUtils.throttle((e) => {
        if (isSwipeTransitioning) return;
        
        currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        // Determine if this is a horizontal swipe
        if (!isDragging && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isDragging = true;
            e.preventDefault();
        }
        
        if (isDragging) {
            // Visual feedback during swipe
            const currentCard = cards[currentCardIndex];
            const progress = Math.max(-1, Math.min(1, deltaX / (window.innerWidth * 0.3)));
            
            // Apply transform for visual feedback
            currentCard.style.transform = `translateX(${deltaX * 0.2}px) scale(${1 - Math.abs(progress) * 0.05})`;
            currentCard.style.opacity = 1 - Math.abs(progress) * 0.1;
        }
    }, 16);
    
    const handleTouchEnd = (e) => {
        if (isSwipeTransitioning) return;
        
        const deltaX = currentX - startX;
        const deltaTime = Date.now() - startTime;
        const velocity = Math.abs(deltaX) / deltaTime;
        
        // Restore transition
        deck.style.transition = '';
        const currentCard = cards[currentCardIndex];
        currentCard.style.transform = '';
        currentCard.style.opacity = '';
        
        if (isDragging) {
            // Determine swipe direction and threshold
            const threshold = window.innerWidth * 0.25;
            const fastSwipe = velocity > 0.5;
            
            if ((Math.abs(deltaX) > threshold || fastSwipe) && deltaTime < 500) {
                if (deltaX > 0 && currentCardIndex > 0) {
                    // Swipe right - previous card
                    switchToCard(currentCardIndex - 1);
                } else if (deltaX < 0 && currentCardIndex < cards.length - 1) {
                    // Swipe left - next card
                    switchToCard(currentCardIndex + 1);
                }
            }
        }
        
        isDragging = false;
    };
    
    // Bind touch events
    deck.addEventListener('touchstart', handleTouchStart, { passive: false });
    deck.addEventListener('touchmove', handleTouchMove, { passive: false });
    deck.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Indicator click handlers
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            if (!isSwipeTransitioning) {
                switchToCard(index);
                if (window.TouchUtils) {
                    window.TouchUtils.hapticFeedback('light');
                }
            }
        });
        
        // Make indicators touch-friendly
        indicator.style.minWidth = '44px';
        indicator.style.minHeight = '44px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
    });
}

/**
 * Switch to specific card with animation
 */
function switchToCard(index) {
    if (index === currentCardIndex || isSwipeTransitioning) return;
    
    isSwipeTransitioning = true;
    const cards = document.querySelectorAll('.area-card');
    const indicators = document.querySelectorAll('.indicator');
    
    // Haptic feedback
    if (window.TouchUtils) {
        window.TouchUtils.hapticFeedback('light');
    }
    
    // Update cards
    cards.forEach((card, i) => {
        card.classList.remove('active', 'prev', 'next');
        
        if (i === index) {
            card.classList.add('active');
        } else if (i < index) {
            card.classList.add('prev');
        } else {
            card.classList.add('next');
        }
    });
    
    // Update indicators
    indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
    });
    
    currentCardIndex = index;
    
    // Reset transition lock after animation
    setTimeout(() => {
        isSwipeTransitioning = false;
    }, 300);
}

/**
 * Update active card on initialization
 */
function updateActiveCard(index) {
    const cards = document.querySelectorAll('.area-card');
    const indicators = document.querySelectorAll('.indicator');
    
    cards.forEach((card, i) => {
        if (i === index) {
            card.classList.add('active');
        } else if (i < index) {
            card.classList.add('prev');
        } else {
            card.classList.add('next');
        }
    });
    
    indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
    });
    
    currentCardIndex = index;
}

/**
 * Initialize mobile gesture handlers
 */
function initializeMobileGestures() {
    // Edge swipe for navigation (future feature)
    let edgeSwipeStartX = 0;
    
    document.addEventListener('touchstart', (e) => {
        if (!window.TouchUtils) return;
        
        const touch = e.touches[0];
        const edges = window.TouchUtils.prototype.isEdgeTouch(touch, 30);
        
        if (edges.left) {
            edgeSwipeStartX = touch.clientX;
        }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        if (!window.TouchUtils || !e.changedTouches[0]) return;
        
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - edgeSwipeStartX;
        
        // Edge swipe to go back (future feature for layout pages)
        if (edgeSwipeStartX < 30 && deltaX > 50) {
            // Could implement navigation back to home
            console.log('[Mobile] Edge swipe detected - back navigation');
        }
        
        edgeSwipeStartX = 0;
    }, { passive: true });
}

/**
 * Initialize PWA install prompt
 */
function initializePWAInstall() {
    // Store the install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('[PWA] Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        showInstallPrompt();
    });
    
    // Handle install button click
    const installBtn = document.getElementById('installBtn');
    const installClose = document.getElementById('installClose');
    const installPrompt = document.getElementById('installPrompt');
    
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            // Show install prompt
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            console.log('[PWA] Install outcome:', outcome);
            
            if (outcome === 'accepted') {
                hideInstallPrompt();
                if (window.TouchUtils) {
                    window.TouchUtils.hapticFeedback('success');
                }
            }
            
            deferredPrompt = null;
        });
    }
    
    if (installClose) {
        installClose.addEventListener('click', () => {
            hideInstallPrompt();
            // Remember user dismissed prompt
            localStorage.setItem('install-prompt-dismissed', Date.now().toString());
        });
    }
    
    // Auto-show install prompt on mobile (if not dismissed recently)
    if (window.MobileDevice?.isMobile && !window.MobileDevice.isStandalone) {
        const dismissed = localStorage.getItem('install-prompt-dismissed');
        const daysSinceDismissed = dismissed ? (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24) : 999;
        
        if (daysSinceDismissed > 7) { // Show again after 7 days
            setTimeout(() => {
                if (deferredPrompt) {
                    showInstallPrompt();
                }
            }, 3000); // Show after 3 seconds
        }
    }
}

/**
 * Show install prompt
 */
function showInstallPrompt() {
    const prompt = document.getElementById('installPrompt');
    if (prompt && !window.MobileDevice?.isStandalone) {
        prompt.classList.add('show');
    }
}

/**
 * Hide install prompt
 */
function hideInstallPrompt() {
    const prompt = document.getElementById('installPrompt');
    if (prompt) {
        prompt.classList.remove('show');
    }
}

/**
 * Initialize stats counter animation
 */
function initializeStatsAnimation() {
    const statNumbers = document.querySelectorAll('.stat-number[data-count]');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const finalValue = parseInt(target.dataset.count);
                
                if (!isNaN(finalValue)) {
                    animateCounter(target, 0, finalValue, window.MobileDevice?.isMobile ? 800 : 1000);
                }
                
                observer.unobserve(target);
            }
        });
    }, {
        threshold: 0.5,
        rootMargin: '0px 0px -10% 0px'
    });
    
    statNumbers.forEach(stat => observer.observe(stat));
}

/**
 * Animate counter with easing
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
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Initialize keyboard navigation (desktop)
 */
function initializeKeyboardNavigation() {
    if (window.MobileDevice?.isMobile) return; // Skip on mobile
    
    document.addEventListener('keydown', function(e) {
        const cards = document.querySelectorAll('.area-card');
        
        if (document.activeElement && document.activeElement.classList.contains('area-card')) {
            const currentIndex = Array.from(cards).indexOf(document.activeElement);
            
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
                    const prevIndex = (currentIndex - 1 + cards.length) % cards.length;
                    cards[prevIndex].focus();
                    break;
                    
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    document.activeElement.click();
                    break;
            }
        }
    });
    
    // Make cards focusable on desktop
    const cards = document.querySelectorAll('.area-card');
    cards.forEach((card, index) => {
        card.setAttribute('tabindex', index === 0 ? '0' : '-1');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Navigate to ${card.querySelector('.area-title').textContent}`);
    });
}

/**
 * Handle device orientation changes
 */
function handleOrientationChange() {
    // Listen for orientation changes
    window.addEventListener('mobile-orientation-change', (event) => {
        const { isLandscape } = event.detail;
        
        console.log('[Mobile] Orientation changed:', isLandscape ? 'landscape' : 'portrait');
        
        if (window.MobileDevice?.isMobile) {
            // Force landscape message handling is done in mobile-utils.js
            // Here we can handle any app-specific orientation logic
            
            if (isLandscape) {
                // Landscape - optimal viewing
                document.body.classList.remove('portrait-mode');
                document.body.classList.add('landscape-mode');
            } else {
                // Portrait - show rotation message
                document.body.classList.remove('landscape-mode');
                document.body.classList.add('portrait-mode');
            }
        }
    });
}

/**
 * Handle page visibility changes for performance
 */
function handleVisibilityChange() {
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Pause animations when page is hidden
            document.body.classList.add('page-hidden');
            
            // Reduce performance on mobile when hidden
            if (window.MobileDevice?.isMobile) {
                // Could pause any background processes here
            }
        } else {
            // Resume animations when page is visible
            document.body.classList.remove('page-hidden');
        }
    });
}

/**
 * Initialize error handling
 */
function initializeErrorHandling() {
    window.addEventListener('error', function(e) {
        console.error('[App] JavaScript error:', e.error);
        
        // Show user-friendly error message
        if (e.error && e.error.message.includes('navigation')) {
            showErrorMessage('Navigation failed. Please try again.');
        }
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(e) {
        console.error('[App] Unhandled promise rejection:', e.reason);
    });
}

/**
 * Show error message to user
 */
function showErrorMessage(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = window.MobileDevice?.isMobile ? 
        'alert alert-danger position-fixed top-0 start-0 end-0 m-3' :
        'alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3';
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
 * Optimize performance based on device capabilities
 */
function optimizePerformance() {
    if (!window.MobileDevice) return;
    
    if (window.MobileDevice.isLowEndDevice) {
        console.log('[Performance] Low-end device detected, applying optimizations');
        
        // Reduce animation duration
        document.documentElement.style.setProperty('--transition', 'all 0.1s ease');
        
        // Disable some visual effects
        document.body.classList.add('low-performance-mode');
        
        // Reduce intersection observer thresholds
        // (Would be applied in initializeStatsAnimation if needed)
    }
    
    if (window.MobileDevice.isMobile) {
        // Mobile-specific optimizations
        document.body.classList.add('mobile-optimized');
        
        // Optimize touch delay
        if ('touchAction' in document.documentElement.style) {
            document.documentElement.style.touchAction = 'manipulation';
        }
    }
}

/**
 * Initialize all functionality when DOM is loaded
 */
function initializeApp() {
    console.log('[App] Initializing Cambridge Stall Planner...');
    
    // Wait for mobile utils to be ready
    if (window.MobileDevice) {
        initializeAppWithMobileDetection();
    } else {
        // Fallback if mobile-utils.js hasn't loaded yet
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeAppWithMobileDetection, 100);
        });
    }
}

/**
 * Initialize app with mobile detection available
 */
function initializeAppWithMobileDetection() {
    // Core functionality
    initializeStatsAnimation();
    initializeKeyboardNavigation();
    handleOrientationChange();
    handleVisibilityChange();
    initializeErrorHandling();
    optimizePerformance();
    
    // PWA functionality
    initializePWAInstall();
    
    // Mobile-specific features
    initializeMobileFeatures();
    
    // Mark app as fully loaded
    setTimeout(() => {
        document.body.classList.add('app-loaded');
    }, 100);
    
    console.log('[App] Cambridge Stall Planner initialized successfully');
    console.log('[App] Device type:', window.MobileDevice?.isMobile ? 'Mobile' : 'Desktop');
    console.log('[App] Standalone mode:', window.MobileDevice?.isStandalone);
}

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}