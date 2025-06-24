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
        return data.map(stall => ({
            name: stall.name || stall.NAME || '',
            stallNumber: parseInt(stall.stallNumber || stall['STALL NUMBER']) || 0,
            location: stall.location || stall.LOCATION || '',
            group: stall.group || stall.GROUP || '',
            leftNeighbour: this.findNeighbour(data, parseInt(stall.stallNumber || stall['STALL NUMBER']) - 1, stall.location || stall.LOCATION),
            rightNeighbour: this.findNeighbour(data, parseInt(stall.stallNumber || stall['STALL NUMBER']) + 1, stall.location || stall.LOCATION)
        }));
    }

    findNeighbour(data, neighbourNumber, location) {
        if (!neighbourNumber || neighbourNumber <= 0) return null;
        
        const neighbour = data.find(stall => {
            const stallNum = parseInt(stall.stallNumber || stall['STALL NUMBER']);
            const stallLoc = stall.location || stall.LOCATION;
            return stallNum === neighbourNumber && stallLoc === location;
        });
        
        return neighbour ? {
            name: neighbour.name || neighbour.NAME,
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
        const trimmedQuery = query.trim().toLowerCase();
        
        if (trimmedQuery.length < 1) {
            this.hideAutocomplete();
            return;
        }

        const results = this.stallData.filter(stall => 
            stall.name.toLowerCase().includes(trimmedQuery)
        ).slice(0, 8); // Limit to 8 results

        this.showAutocompleteResults(results, trimmedQuery);
    }

    showAutocompleteResults(results, query) {
        const autocompleteContainer = document.getElementById('autocompleteResults');
        
        if (results.length === 0) {
            // Better empty state for search
            autocompleteContainer.innerHTML = `
                <div class="autocomplete-no-results">
                    <div class="no-results-icon">🔍</div>
                    <div class="no-results-text">
                        <strong>No stallholders found</strong>
                        <p>Try searching for something else or browse all stalls</p>
                    </div>
                    <div class="no-results-actions">
                        <button class="btn-clear-search" onclick="window.stallFinder.clearSearch()">Clear Search</button>
                        <button class="btn-browse-all" onclick="window.stallFinder.showAllStalls()">Browse All</button>
                    </div>
                </div>
            `;
        } else {
            autocompleteContainer.innerHTML = results.map((stall, index) => `
                <div class="autocomplete-item" data-index="${index}" tabindex="0">
                    <span class="autocomplete-name">${this.highlightMatch(stall.name, query)}</span>
                    <div class="autocomplete-details">
                        <span>Stall ${stall.stallNumber}</span>
                        <span>${stall.location}</span>
                    </div>
                </div>
            `).join('');

            // Add click listeners to autocomplete items
            autocompleteContainer.querySelectorAll('.autocomplete-item').forEach((item, index) => {
                if (results[index]) {
                    item.addEventListener('click', () => {
                        this.selectStall(results[index]);
                        this.hideAutocomplete();
                    });
                }
            });
        }

        autocompleteContainer.style.display = 'block';
        this.selectedStallIndex = -1;
    }

    highlightMatch(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
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

        stallsList.innerHTML = sortedStalls.map(stall => `
            <div class="stall-card" data-stall-id="${stall.stallNumber}">
                <div class="stall-card-header">
                    <h3 class="stall-name">${stall.name}</h3>
                    <span class="stall-number">${stall.stallNumber}</span>
                </div>
                <div class="stall-details">
                    <div class="stall-location">
                        <span class="location-badge">${stall.location}</span>
                    </div>
                    <div class="stall-group">
                        <span class="group-badge">${stall.group}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click listeners to stall cards
        stallsList.querySelectorAll('.stall-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const stallId = parseInt(card.dataset.stallId);
                const stall = this.stallData.find(s => s.stallNumber === stallId);
                if (stall) {
                    this.showStallDetails(stall);
                }
            });

            // Add keyboard navigation
            card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
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

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
                <span class="toast-message">${message}</span>
                ${options.action ? `<button class="toast-action" onclick="this.closest('.toast').remove(); (${options.callback.toString()})()">${options.action}</button>` : ''}
            </div>
            <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
        `;

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