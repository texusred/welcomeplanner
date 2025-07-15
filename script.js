// Freshers Fair Stall Finder - JavaScript
// ARU Students' Union

class StallFinder {
    constructor() {
        this.stallData = [];
        this.filteredStalls = [];
        this.currentView = 'search';
        this.currentFilter = 'all';
        this.selectedStallIndex = -1;
        this.dataLoaded = false;
        this.searchDebounceTimer = null;
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            // Don't load data immediately - wait for first user interaction
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to initialize app. Please refresh the page.', 'error');
        }
    }

    async loadStallData() {
        if (this.dataLoaded) return; // Already loaded
        
        try {
            this.showLoading();
            const response = await fetch('data/stallholders.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Validate data before processing
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format: expected array');
            }
            
            this.stallData = this.processStallData(data);
            this.dataLoaded = true;
            this.hideLoading();
        } catch (error) {
            console.error('Error loading stall data:', error);
            this.hideLoading();
            this.showToast('Failed to load stall data. Please check your connection and try again.', 'error', {
                action: 'Retry',
                callback: () => {
                    this.dataLoaded = false;
                    this.loadStallData();
                }
            });
            throw error;
        }
    }

    processStallData(data) {
        return data.map(stall => {
            // Validate and sanitize stall data
            if (!stall || typeof stall !== 'object') {
                console.warn('Invalid stall object:', stall);
                return null;
            }
            
            const name = this.sanitizeString(stall.name || stall.NAME || '');
            const location = this.sanitizeString(stall.location || stall.LOCATION || '');
            const group = this.sanitizeString(stall.group || stall.GROUP || '');
            const stallNumber = parseInt(stall.stallNumber || stall['STALL NUMBER']) || 0;
            
            if (!name || stallNumber <= 0) {
                console.warn('Invalid stall data:', { name, stallNumber });
                return null;
            }
            
            return {
                name,
                stallNumber,
                location,
                group,
                leftNeighbour: this.findNeighbour(data, stallNumber - 1, location),
                rightNeighbour: this.findNeighbour(data, stallNumber + 1, location)
            };
        }).filter(stall => stall !== null); // Remove invalid entries
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, ''); // Basic sanitization
    }

    findNeighbour(data, neighbourNumber, location) {
        if (!neighbourNumber || neighbourNumber <= 0) return null;
        
        const neighbour = data.find(stall => {
            const stallNum = parseInt(stall.stallNumber || stall['STALL NUMBER']);
            const stallLoc = stall.location || stall.LOCATION;
            return stallNum === neighbourNumber && stallLoc === location;
        });
        
        return neighbour ? {
            name: this.sanitizeString(neighbour.name || neighbour.NAME),
            stallNumber: neighbourNumber
        } : null;
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('stallSearch');
        const autocompleteResults = document.getElementById('autocompleteResults');
        
        searchInput.addEventListener('input', (e) => {
            this.handleSearchInputDebounced(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });

        // Click outside to close autocomplete
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-input-container')) {
                this.hideAutocomplete();
            }
        });

        // Show all stalls button
        document.getElementById('showAllStalls').addEventListener('click', async () => {
            await this.ensureDataLoaded();
            this.showAllStalls();
        });

        // Back to search button
        document.getElementById('backToSearch').addEventListener('click', () => {
            this.showSearchView();
        });

        // Location filter tabs
        document.querySelectorAll('.location-tab').forEach(tab => {
            tab.addEventListener('click', async (e) => {
                await this.ensureDataLoaded();
                this.filterByLocation(e.target.dataset.location);
            });
        });

        // Modal functionality
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('stallModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.hideModal();
            }
        });

        // View on Map functionality
        document.getElementById('viewOnMap').addEventListener('click', () => {
            this.handleViewOnMap();
        });

        // Share functionality
        document.getElementById('shareStall').addEventListener('click', () => {
            this.handleShareStall();
        });

        // ADMIN ACCESS - REMOVABLE FOR PRODUCTION
        const adminAccessBtn = document.getElementById('adminAccess');
        if (adminAccessBtn) {
            adminAccessBtn.addEventListener('click', () => {
                this.handleAdminAccess();
            });
        }

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
            }
        });
    }

    // Ensure data is loaded before performing operations
    async ensureDataLoaded() {
        if (!this.dataLoaded) {
            await this.loadStallData();
        }
    }

    // Debounced search input handler
    handleSearchInputDebounced(query) {
        // Clear existing timer
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }

        // Set new timer
        this.searchDebounceTimer = setTimeout(async () => {
            await this.ensureDataLoaded();
            this.handleSearchInput(query);
        }, 300); // Wait 300ms after user stops typing
    }

    async handleSearchInput(query) {
        const trimmedQuery = this.sanitizeString(query);
        
        if (trimmedQuery.length < 1) {
            this.hideAutocomplete();
            return;
        }

        const results = this.stallData.filter(stall => 
            stall.name.toLowerCase().includes(trimmedQuery.toLowerCase())
        ).slice(0, 8); // Limit to 8 results

        this.showAutocompleteResults(results, trimmedQuery);
    }

    showAutocompleteResults(results, query) {
        const autocompleteContainer = document.getElementById('autocompleteResults');
        
        // Clear previous results
        autocompleteContainer.innerHTML = '';
        
        if (results.length === 0) {
            // Better empty state for search
            const noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'autocomplete-no-results';
            
            const iconDiv = document.createElement('div');
            iconDiv.className = 'no-results-icon';
            iconDiv.textContent = '🔍';
            
            const textDiv = document.createElement('div');
            textDiv.className = 'no-results-text';
            textDiv.innerHTML = '<strong>No stallholders found</strong><p>Try searching for something else or browse all stalls</p>';
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'no-results-actions';
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'btn-clear-search';
            clearBtn.textContent = 'Clear Search';
            clearBtn.onclick = () => this.clearSearch();
            
            const browseBtn = document.createElement('button');
            browseBtn.className = 'btn-browse-all';
            browseBtn.textContent = 'Browse All';
            browseBtn.onclick = () => this.showAllStalls();
            
            actionsDiv.appendChild(clearBtn);
            actionsDiv.appendChild(browseBtn);
            
            noResultsDiv.appendChild(iconDiv);
            noResultsDiv.appendChild(textDiv);
            noResultsDiv.appendChild(actionsDiv);
            
            autocompleteContainer.appendChild(noResultsDiv);
        } else {
            results.forEach((stall, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'autocomplete-item';
                itemDiv.dataset.index = index;
                itemDiv.tabIndex = 0;
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'autocomplete-name';
                nameSpan.appendChild(this.createHighlightedText(stall.name, query));
                
                const detailsDiv = document.createElement('div');
                detailsDiv.className = 'autocomplete-details';
                
                const stallSpan = document.createElement('span');
                stallSpan.textContent = `Stall ${stall.stallNumber}`;
                
                const locationSpan = document.createElement('span');
                locationSpan.textContent = stall.location;
                
                detailsDiv.appendChild(stallSpan);
                detailsDiv.appendChild(locationSpan);
                
                itemDiv.appendChild(nameSpan);
                itemDiv.appendChild(detailsDiv);
                
                // Add click listener
                itemDiv.addEventListener('click', () => {
                    this.selectStall(stall);
                    this.hideAutocomplete();
                });
                
                autocompleteContainer.appendChild(itemDiv);
            });
        }

        autocompleteContainer.style.display = 'block';
        this.selectedStallIndex = -1;
    }

    // Safe text highlighting - no XSS vulnerability
    createHighlightedText(text, query) {
        const fragment = document.createDocumentFragment();
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        let lastIndex = 0;
        let index = lowerText.indexOf(lowerQuery, lastIndex);
        
        while (index !== -1) {
            // Add text before match
            if (index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
            }
            
            // Add highlighted match
            const strong = document.createElement('strong');
            strong.textContent = text.substring(index, index + query.length);
            fragment.appendChild(strong);
            
            lastIndex = index + query.length;
            index = lowerText.indexOf(lowerQuery, lastIndex);
        }
        
        // Add remaining text
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        
        return fragment;
    }

    handleKeyNavigation(e) {
        const autocompleteContainer = document.getElementById('autocompleteResults');
        const items = autocompleteContainer.querySelectorAll('.autocomplete-item');
        
        if (items.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedStallIndex = Math.min(this.selectedStallIndex + 1, items.length - 1);
                this.updateSelection(items);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedStallIndex = Math.max(this.selectedStallIndex - 1, -1);
                this.updateSelection(items);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.selectedStallIndex >= 0 && items[this.selectedStallIndex]) {
                    items[this.selectedStallIndex].click();
                }
                break;
                
            case 'Escape':
                this.hideAutocomplete();
                break;
        }
    }

    updateSelection(items) {
        items.forEach((item, index) => {
            item.classList.toggle('highlighted', index === this.selectedStallIndex);
        });
    }

    hideAutocomplete() {
        document.getElementById('autocompleteResults').style.display = 'none';
        this.selectedStallIndex = -1;
    }

    clearSearch() {
        document.getElementById('stallSearch').value = '';
        this.hideAutocomplete();
        document.getElementById('stallSearch').focus();
    }

    selectStall(stall) {
        this.showStallDetails(stall);
        document.getElementById('stallSearch').value = stall.name;
    }

    showStallDetails(stall) {
        // Store current stall for "View on Map" and "Share" functionality
        this.currentStall = stall;

        // Populate modal with stall details
        document.getElementById('modalStallName').textContent = stall.name;
        document.getElementById('modalStallNumber').textContent = stall.stallNumber;
        document.getElementById('modalLocation').textContent = stall.location;
        document.getElementById('modalGroup').textContent = stall.group;

        // Handle neighbours
        const leftNeighbour = document.getElementById('modalLeftNeighbour');
        const rightNeighbour = document.getElementById('modalRightNeighbour');

        if (stall.leftNeighbour) {
            leftNeighbour.textContent = `${stall.leftNeighbour.name} (Stall ${stall.leftNeighbour.stallNumber})`;
            leftNeighbour.classList.remove('no-neighbour');
        } else {
            leftNeighbour.textContent = 'No neighbouring stall';
            leftNeighbour.classList.add('no-neighbour');
        }

        if (stall.rightNeighbour) {
            rightNeighbour.textContent = `${stall.rightNeighbour.name} (Stall ${stall.rightNeighbour.stallNumber})`;
            rightNeighbour.classList.remove('no-neighbour');
        } else {
            rightNeighbour.textContent = 'No neighbouring stall';
            rightNeighbour.classList.add('no-neighbour');
        }

        // Show/hide share button based on Web Share API support
        const shareButton = document.getElementById('shareStall');
        if (navigator.share) {
            shareButton.style.display = 'block';
        } else {
            shareButton.style.display = 'none';
        }

        this.showModal();
    }

    // Handle View on Map functionality
    handleViewOnMap() {
        if (!this.currentStall) return;

        // Hide current modal
        this.hideModal();

        // Navigate to appropriate map based on location
        const location = this.currentStall.location;
        const stallNumber = this.currentStall.stallNumber;

        // Generate map filename from location
        const mapFile = location.toLowerCase().replace(/\s+/g, '-') + '.html';
        
        // Navigate to map with highlight parameter
        window.location.href = `maps/${mapFile}?highlight=${stallNumber}`;
    }

    // Handle Share Stallholder functionality
    async handleShareStall() {
        if (!this.currentStall || !navigator.share) return;

        try {
            await navigator.share({
                title: `${this.currentStall.name} - ARU Welcome Fair`,
                text: `Check out ${this.currentStall.name} at the ARU Students' Union Welcome Fair! Find them at Stall #${this.currentStall.stallNumber} in ${this.currentStall.location}.`,
                url: window.location.href
            });
            
            this.showToast('Stall shared successfully!', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') { // User cancelled
                console.error('Error sharing:', error);
                this.showToast('Unable to share. You can copy the URL instead.', 'info');
            }
        }
    }

    // ADMIN ACCESS FUNCTIONALITY - REMOVABLE FOR PRODUCTION
    handleAdminAccess() {
        // Simple confirmation to prevent accidental access
        const confirmed = confirm('Access admin tools? This is for authorized users only.');
        
        if (confirmed) {
            // Navigate to admin dashboard
            window.location.href = 'admin/admin-dashboard.html';
        }
    }

    showModal() {
        const modal = document.getElementById('stallModal');
        modal.style.display = 'flex';
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Focus management for accessibility
        setTimeout(() => {
            document.getElementById('closeModal').focus();
        }, 100);
    }

    hideModal() {
        const modal = document.getElementById('stallModal');
        modal.style.display = 'none';
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Return focus to search input
        document.getElementById('stallSearch').focus();
    }

    async showAllStalls() {
        await this.ensureDataLoaded();
        
        this.currentView = 'all';
        this.currentFilter = 'all';
        this.filteredStalls = [...this.stallData];
        
        document.querySelector('.search-section').style.display = 'none';
        document.getElementById('allStallsSection').style.display = 'block';
        
        this.updateLocationTabs();
        this.renderStallsList();
    }

    showSearchView() {
        this.currentView = 'search';
        
        document.querySelector('.search-section').style.display = 'block';
        document.getElementById('allStallsSection').style.display = 'none';
        
        // Clear search input and refocus
        const searchInput = document.getElementById('stallSearch');
        searchInput.value = '';
        searchInput.focus();
        this.hideAutocomplete();
    }

    filterByLocation(location) {
        this.currentFilter = location;
        
        if (location === 'all') {
            this.filteredStalls = [...this.stallData];
        } else {
            this.filteredStalls = this.stallData.filter(stall => stall.location === location);
        }
        
        this.updateLocationTabs();
        this.renderStallsList();
    }

    updateLocationTabs() {
        document.querySelectorAll('.location-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.location === this.currentFilter);
        });
    }

    renderStallsList() {
        const stallsList = document.getElementById('stallsList');
        
        if (this.filteredStalls.length === 0) {
            stallsList.innerHTML = `
                <div class="no-results">
                    <p>No stalls found for this location.</p>
                </div>
            `;
            return;
        }

        // Sort stalls by stall number
        const sortedStalls = [...this.filteredStalls].sort((a, b) => a.stallNumber - b.stallNumber);

        // Clear and rebuild stall list using safe DOM methods
        stallsList.innerHTML = '';
        
        sortedStalls.forEach(stall => {
            const stallCard = document.createElement('div');
            stallCard.className = 'stall-card';
            stallCard.dataset.stallId = stall.stallNumber;
            stallCard.tabIndex = 0;
            
            const cardHeader = document.createElement('div');
            cardHeader.className = 'stall-card-header';
            
            const stallName = document.createElement('h3');
            stallName.className = 'stall-name';
            stallName.textContent = stall.name;
            
            const stallNumber = document.createElement('span');
            stallNumber.className = 'stall-number';
            stallNumber.textContent = stall.stallNumber;
            
            cardHeader.appendChild(stallName);
            cardHeader.appendChild(stallNumber);
            
            const stallDetails = document.createElement('div');
            stallDetails.className = 'stall-details';
            
            const stallLocation = document.createElement('div');
            stallLocation.className = 'stall-location';
            const locationBadge = document.createElement('span');
            locationBadge.className = 'location-badge';
            locationBadge.textContent = stall.location;
            stallLocation.appendChild(locationBadge);
            
            const stallGroup = document.createElement('div');
            stallGroup.className = 'stall-group';
            const groupBadge = document.createElement('span');
            groupBadge.className = 'group-badge';
            groupBadge.textContent = stall.group;
            stallGroup.appendChild(groupBadge);
            
            stallDetails.appendChild(stallLocation);
            stallDetails.appendChild(stallGroup);
            
            stallCard.appendChild(cardHeader);
            stallCard.appendChild(stallDetails);
            
            // Add click listeners
            stallCard.addEventListener('click', () => {
                this.showStallDetails(stall);
            });

            // Add keyboard navigation
            stallCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.showStallDetails(stall);
                }
            });
            
            stallsList.appendChild(stallCard);
        });
    }

    showLoading() {
        document.getElementById('loadingIndicator').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingIndicator').style.display = 'none';
    }

    // Toast notification system for better error/success messages
    showToast(message, type = 'info', options = {}) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconMap = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toastContent = document.createElement('div');
        toastContent.className = 'toast-content';
        
        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.textContent = iconMap[type] || iconMap.info;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'toast-message';
        messageSpan.textContent = message;
        
        toastContent.appendChild(icon);
        toastContent.appendChild(messageSpan);
        
        if (options.action && options.callback) {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'toast-action';
            actionBtn.textContent = options.action;
            actionBtn.onclick = () => {
                toast.remove();
                options.callback();
            };
            toastContent.appendChild(actionBtn);
        }
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => toast.remove();
        
        toast.appendChild(toastContent);
        toast.appendChild(closeBtn);

        // Add to toast container
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        container.appendChild(toast);

        // Auto remove after 5 seconds (unless it has an action)
        if (!options.action) {
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 5000);
        }

        // Animate in
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);
    }

    // Utility method for debugging
    getStallByNumber(stallNumber) {
        return this.stallData.find(stall => stall.stallNumber === stallNumber);
    }

    // Utility method to get all locations
    getLocations() {
        return [...new Set(this.stallData.map(stall => stall.location))];
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.stallFinder = new StallFinder();
});

// Service Worker registration for offline capability (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}