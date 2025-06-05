// Cambridge Stall Planner - Mobile Utilities
// Device detection, orientation handling, and mobile-specific functionality

/**
 * Mobile Detection and Device Information
 */
class MobileDetection {
    constructor() {
        this.userAgent = navigator.userAgent.toLowerCase();
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone === true;
        
        this.detectDevice();
        this.bindOrientationEvents();
    }

    /**
     * Detect device type and capabilities
     */
    detectDevice() {
        // Mobile device detection
        this.isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(this.userAgent) || 
                       window.innerWidth <= 768;
        
        // Specific device detection
        this.isIOS = /iphone|ipad|ipod/i.test(this.userAgent);
        this.isAndroid = /android/i.test(this.userAgent);
        this.isIPad = /ipad/i.test(this.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        // Screen information
        this.screenWidth = window.screen.width;
        this.screenHeight = window.screen.height;
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;
        
        // Performance information
        this.isLowEndDevice = this.detectLowEndDevice();
        this.hasHapticFeedback = 'vibrate' in navigator;
        
        console.log('[Mobile] Device detected:', {
            isMobile: this.isMobile,
            isIOS: this.isIOS,
            isAndroid: this.isAndroid,
            isTouchDevice: this.isTouchDevice,
            isStandalone: this.isStandalone,
            isLowEndDevice: this.isLowEndDevice
        });
    }

    /**
     * Detect low-end devices for performance optimization
     */
    detectLowEndDevice() {
        // Check for low memory or slow processor indicators
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const lowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
        const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
        const oldDevice = this.screenWidth < 375 || this.screenHeight < 667;
        
        return lowConnection || lowMemory || oldDevice;
    }

    /**
     * Check if device is in landscape orientation
     */
    isLandscape() {
        return window.innerWidth > window.innerHeight;
    }

    /**
     * Bind orientation change events
     */
    bindOrientationEvents() {
        // Modern orientation API
        if (screen.orientation) {
            screen.orientation.addEventListener('change', () => {
                this.handleOrientationChange();
            });
        } else {
            // Fallback for older browsers
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this.handleOrientationChange(), 100);
            });
        }

        // Viewport resize handling
        window.addEventListener('resize', () => {
            this.handleViewportResize();
        });
    }

    /**
     * Handle orientation changes
     */
    handleOrientationChange() {
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;
        
        console.log('[Mobile] Orientation changed:', {
            width: this.viewportWidth,
            height: this.viewportHeight,
            isLandscape: this.isLandscape()
        });

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('mobile-orientation-change', {
            detail: {
                isLandscape: this.isLandscape(),
                width: this.viewportWidth,
                height: this.viewportHeight
            }
        }));

        // Show/hide orientation message
        this.updateOrientationMessage();
    }

    /**
     * Handle viewport resize
     */
    handleViewportResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.viewportWidth = window.innerWidth;
            this.viewportHeight = window.innerHeight;
            
            window.dispatchEvent(new CustomEvent('mobile-viewport-resize', {
                detail: {
                    width: this.viewportWidth,
                    height: this.viewportHeight
                }
            }));
        }, 150);
    }

    /**
     * Show/hide orientation message
     */
    updateOrientationMessage() {
        if (!this.isMobile) return;

        let overlay = document.getElementById('orientation-overlay');
        
        if (!this.isLandscape()) {
            // Show rotation message
            if (!overlay) {
                overlay = this.createOrientationOverlay();
                document.body.appendChild(overlay);
            }
            overlay.classList.add('active');
        } else {
            // Hide rotation message
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    }

    /**
     * Create orientation overlay
     */
    createOrientationOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'orientation-overlay';
        overlay.innerHTML = `
            <div class="orientation-content">
                <div class="rotation-icon">
                    <i class="fas fa-mobile-alt"></i>
                    <i class="fas fa-redo-alt"></i>
                </div>
                <h3>Please Rotate Your Device</h3>
                <p>This app works best in landscape mode</p>
            </div>
        `;
        
        return overlay;
    }
}

/**
 * Touch and Gesture Utilities
 */
class TouchUtils {
    constructor() {
        this.activeTouch = null;
        this.touchStartTime = 0;
        this.lastTap = 0;
        this.tapThreshold = 300; // ms
        this.doubleTapThreshold = 300; // ms
        this.longPressThreshold = 500; // ms
        this.swipeThreshold = 50; // px
        this.edgeSwipeThreshold = 30; // px from edge
    }

    /**
     * Add haptic feedback if available
     */
    static hapticFeedback(type = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: [10],
                medium: [20],
                heavy: [30],
                success: [10, 20, 10],
                error: [50, 50, 50]
            };
            
            navigator.vibrate(patterns[type] || patterns.light);
        }
    }

    /**
     * Detect touch gesture type
     */
    detectGesture(startTouch, endTouch, duration) {
        const deltaX = endTouch.clientX - startTouch.clientX;
        const deltaY = endTouch.clientY - startTouch.clientY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Long press
        if (duration > this.longPressThreshold && distance < 10) {
            return { type: 'longpress', deltaX, deltaY, distance, duration };
        }
        
        // Swipe detection
        if (distance > this.swipeThreshold) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            let direction;
            
            if (Math.abs(angle) < 45) direction = 'right';
            else if (Math.abs(angle) > 135) direction = 'left';
            else if (angle > 0) direction = 'down';
            else direction = 'up';
            
            return { type: 'swipe', direction, deltaX, deltaY, distance, duration };
        }
        
        // Tap
        if (duration < this.tapThreshold && distance < 10) {
            return { type: 'tap', deltaX, deltaY, distance, duration };
        }
        
        return { type: 'unknown', deltaX, deltaY, distance, duration };
    }

    /**
     * Check if touch is on screen edge
     */
    isEdgeTouch(touch, threshold = this.edgeSwipeThreshold) {
        const { clientX, clientY } = touch;
        const { innerWidth, innerHeight } = window;
        
        return {
            left: clientX < threshold,
            right: clientX > innerWidth - threshold,
            top: clientY < threshold,
            bottom: clientY > innerHeight - threshold
        };
    }

    /**
     * Prevent default touch behaviors
     */
    static preventDefaults(element) {
        element.style.touchAction = 'none';
        element.style.userSelect = 'none';
        element.style.webkitUserSelect = 'none';
        element.style.webkitTouchCallout = 'none';
    }

    /**
     * Enable touch behaviors
     */
    static enableDefaults(element) {
        element.style.touchAction = 'auto';
        element.style.userSelect = 'auto';
        element.style.webkitUserSelect = 'auto';
        element.style.webkitTouchCallout = 'default';
    }
}

/**
 * Performance Optimization Utilities
 */
class PerformanceUtils {
    constructor() {
        this.animationFrame = null;
        this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Throttle function calls
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Debounce function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Request animation frame with fallback
     */
    static requestFrame(callback) {
        return window.requestAnimationFrame(callback);
    }

    /**
     * Cancel animation frame
     */
    static cancelFrame(id) {
        window.cancelAnimationFrame(id);
    }

    /**
     * Optimize element for animations
     */
    static optimizeForAnimation(element) {
        element.style.willChange = 'transform';
        element.style.transform = 'translateZ(0)'; // Force hardware acceleration
    }

    /**
     * Remove animation optimizations
     */
    static removeAnimationOptimization(element) {
        element.style.willChange = 'auto';
        element.style.transform = '';
    }
}

/**
 * Navigation and Routing Utilities
 */
class NavigationUtils {
    constructor() {
        this.currentArea = this.getCurrentArea();
        this.history = [];
        this.bindPopState();
    }

    /**
     * Get current area from URL
     */
    getCurrentArea() {
        const path = window.location.pathname;
        if (path.includes('ruskin')) return 'ruskin';
        if (path.includes('science')) return 'science';
        if (path.includes('lab')) return 'lab';
        return 'home';
    }

    /**
     * Navigate to area
     */
    navigateToArea(area) {
        const urls = {
            home: '/',
            ruskin: '/ruskin-courtyard.html',
            science: '/science-walkway.html',
            lab: '/lab-courtyard.html'
        };

        if (urls[area]) {
            this.history.push(this.currentArea);
            this.currentArea = area;
            window.location.href = urls[area];
        }
    }

    /**
     * Go back in navigation
     */
    goBack() {
        if (this.history.length > 0) {
            const previousArea = this.history.pop();
            this.navigateToArea(previousArea);
        } else {
            this.navigateToArea('home');
        }
    }

    /**
     * Bind popstate for browser back button
     */
    bindPopState() {
        window.addEventListener('popstate', () => {
            this.currentArea = this.getCurrentArea();
        });
    }
}

/**
 * Initialize mobile utilities
 */
function initializeMobileUtils() {
    // Create global instances
    window.MobileDevice = new MobileDetection();
    window.TouchUtils = TouchUtils;
    window.PerformanceUtils = PerformanceUtils;
    window.NavigationUtils = new NavigationUtils();

    // Add mobile class to body
    if (window.MobileDevice.isMobile) {
        document.body.classList.add('mobile-device');
        
        if (window.MobileDevice.isIOS) {
            document.body.classList.add('ios-device');
        }
        
        if (window.MobileDevice.isAndroid) {
            document.body.classList.add('android-device');
        }
        
        if (window.MobileDevice.isLowEndDevice) {
            document.body.classList.add('low-end-device');
        }

        if (window.MobileDevice.isStandalone) {
            document.body.classList.add('standalone-app');
        }
    }

    // Set initial orientation state
    if (window.MobileDevice.isMobile) {
        window.MobileDevice.updateOrientationMessage();
    }

    console.log('[Mobile Utils] Initialized successfully');
}

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMobileUtils);
} else {
    initializeMobileUtils();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MobileDetection,
        TouchUtils,
        PerformanceUtils,
        NavigationUtils,
        initializeMobileUtils
    };
}