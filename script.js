// Location configuration for different campuses
const LOCATION_CONFIG = {
    cambridge: ['Ruskin Courtyard', 'LAB Courtyard', 'Science Walkway'],
    chelmsford: ['Central Walkway']
};

class UnionEventManager {
    constructor() {
        this.currentLocation = 'cambridge';
        this.staffData = null;
        this.stallholderData = null;
        this.currentTime = new Date();
        this.dataLoaded = false;
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.startTimeUpdater();
            await this.loadData();
            this.dataLoaded = true;
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showToast('Failed to load data. Please refresh the page.', 'error');
        }
    }

    async loadData() {
        try {
            this.showLoading();
            
            const [staffResponse, stallholderResponse] = await Promise.all([
                fetch(`data/${this.currentLocation}-staff-rota.json`),
                fetch(`data/${this.currentLocation}-stallholders.json`)
            ]);

            if (!staffResponse.ok || !stallholderResponse.ok) {
                throw new Error('Failed to fetch data');
            }

            const staffData = await staffResponse.json();
            const stallholderData = await stallholderResponse.json();

            this.staffData = this.validateAndSanitizeStaffData(staffData);
            this.stallholderData = this.validateAndSanitizeStallholderData(stallholderData);
            
            this.hideLoading();
            this.updateLocationDisplay();
        } catch (error) {
            console.error('Error loading data:', error);
            this.hideLoading();
            this.showToast('Failed to load data. Please check your connection.', 'error');
            throw error;
        }
    }

    validateAndSanitizeStaffData(data) {
        if (!data || !data.staff || !Array.isArray(data.staff)) {
            throw new Error('Invalid staff data structure');
        }

        const sanitizedStaff = data.staff.map(person => {
            if (!person || typeof person !== 'object') return null;
            
            const name = this.sanitizeString(person.name || '');
            if (!name) return null;
            
            const schedule = Array.isArray(person.schedule) ? 
                person.schedule.map(slot => {
                    if (!slot || typeof slot !== 'object') return null;
                    return {
                        timeSlot: this.sanitizeString(slot.timeSlot || ''),
                        task: this.sanitizeString(slot.task || ''),
                        taskName: this.sanitizeString(slot.taskName || '')
                    };
                }).filter(Boolean) : [];

            return { name, schedule };
        }).filter(Boolean);

        return { staff: sanitizedStaff };
    }

    validateAndSanitizeStallholderData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Invalid stallholder data format');
        }

        const validLocations = LOCATION_CONFIG[this.currentLocation] || [];

        return data.map(stall => {
            if (!stall || typeof stall !== 'object') return null;
            
            const name = this.sanitizeString(stall.name || '');
            const location = this.sanitizeString(stall.location || '');
            const group = this.sanitizeString(stall.group || '');
            const stallNumber = parseInt(stall.stallNumber) || 0;

            if (!name || stallNumber <= 0) return null;

            // Auto-migrate location data for current campus
            let validatedLocation = location;
            if (!validLocations.includes(location)) {
                // For Chelmsford, migrate any invalid location to Central Walkway
                if (this.currentLocation === 'chelmsford') {
                    validatedLocation = 'Central Walkway';
                } else {
                    // For Cambridge, default to Ruskin Courtyard if invalid
                    validatedLocation = validLocations.includes(location) ? location : 'Ruskin Courtyard';
                }
            }

            return { name, stallNumber, location: validatedLocation, group };
        }).filter(Boolean);
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, '');
    }

    setupEventListeners() {
        // Location switcher
        document.getElementById('campusSelect').addEventListener('change', async (e) => {
            this.currentLocation = e.target.value;
            await this.loadData();
            this.clearResults();
        });

        // Staff search
        const staffSearchInput = document.getElementById('staffSearch');
        staffSearchInput.addEventListener('input', (e) => {
            this.handleStaffSearch(e.target.value);
        });

        // Location filter
        document.getElementById('locationFilter').addEventListener('change', (e) => {
            this.handleLocationFilter(e.target.value);
        });

        // Stallholder search
        const stallholderSearchInput = document.getElementById('stallholderSearch');
        stallholderSearchInput.addEventListener('input', (e) => {
            this.handleStallholderSearch(e.target.value);
        });

        // List all stallholders
        document.getElementById('listAllStallholders').addEventListener('click', () => {
            this.showAllStallholders();
        });

        // Edit stallholders with password - now passes campus context
        document.getElementById('editStallholdersBtn').addEventListener('click', () => {
            this.handleEditStallholders();
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
    }

    startTimeUpdater() {
        this.updateCurrentTime();
        setInterval(() => {
            this.updateCurrentTime();
        }, 1000);
    }

    updateCurrentTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        document.getElementById('currentTime').textContent = timeStr;
        this.currentTime = now;
    }

    updateLocationDisplay() {
        const locationName = this.currentLocation.charAt(0).toUpperCase() + this.currentLocation.slice(1);
        document.title = `Staff Rota & Event Management - ${locationName} | UNION`;
    }

    handleStaffSearch(query) {
        if (!this.staffData || query.length < 2) {
            this.clearStaffResults();
            return;
        }

        const searchTerm = query.toLowerCase();
        const matchingStaff = this.staffData.staff.filter(person => 
            person.name.toLowerCase().includes(searchTerm)
        );

        if (matchingStaff.length === 0) {
            this.showNoStaffResults(query);
        } else if (matchingStaff.length === 1) {
            this.showStaffSchedule(matchingStaff[0]);
        } else {
            this.showStaffList(matchingStaff);
        }
    }

    handleLocationFilter(location) {
        if (!this.staffData || !location) {
            this.clearStaffResults();
            return;
        }

        const staffAtLocation = this.staffData.staff.filter(person => 
            person.schedule.some(slot => slot.taskName === location)
        );

        this.showLocationStaff(location, staffAtLocation);
    }

    showStaffSchedule(person) {
        const currentTimeStr = this.currentTime.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });

        let scheduleHTML = `
            <div class="staff-schedule">
                <h4>Schedule for ${person.name}</h4>
                <div class="schedule-table">
                    <div class="schedule-header">
                        <span>Time</span>
                        <span>Task</span>
                        <span>Status</span>
                    </div>
        `;

        person.schedule.forEach(slot => {
            const status = this.getShiftStatus(slot.timeSlot);
            const statusClass = status.toLowerCase().replace(' ', '-');
            
            scheduleHTML += `
                <div class="schedule-row ${statusClass}">
                    <span>${slot.timeSlot}</span>
                    <span>${slot.taskName}</span>
                    <span class="status-${statusClass}">${status}</span>
                </div>
            `;
        });

        scheduleHTML += `</div></div>`;
        document.getElementById('staffResults').innerHTML = scheduleHTML;
    }

    showLocationStaff(location, staffList) {
        let html = `
            <div class="location-staff">
                <h4>Staff at: ${location}</h4>
                <div class="staff-list">
        `;

        staffList.forEach(person => {
            const shifts = person.schedule
                .filter(slot => slot.taskName === location)
                .map(slot => slot.timeSlot)
                .join(', ');
            
            const currentStatus = this.getPersonCurrentStatus(person);
            
            html += `
                <div class="staff-item">
                    <div class="staff-info">
                        <strong>${person.name}</strong>
                        <small>${shifts}</small>
                    </div>
                    <span class="status-${currentStatus.toLowerCase()}">${currentStatus}</span>
                </div>
            `;
        });

        html += `</div></div>`;
        document.getElementById('staffResults').innerHTML = html;
    }

    getShiftStatus(timeSlot) {
        const [startTime] = timeSlot.split('-');
        const currentTimeStr = this.currentTime.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        if (timeSlot.includes(currentTimeStr.substring(0, 5))) {
            return 'ACTIVE';
        } else if (startTime > currentTimeStr.substring(0, 5)) {
            return 'Upcoming';
        } else {
            return 'Complete';
        }
    }

    getPersonCurrentStatus(person) {
        const currentTimeStr = this.currentTime.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });

        for (let slot of person.schedule) {
            if (slot.timeSlot.includes(currentTimeStr.substring(0, 5))) {
                return 'ACTIVE';
            }
        }
        return 'Off shift';
    }

    showStaffList(staffList) {
        let html = `
            <div class="staff-search-results">
                <h4>Found ${staffList.length} staff members:</h4>
                <div class="staff-list">
        `;

        staffList.forEach(person => {
            const currentStatus = this.getPersonCurrentStatus(person);
            html += `
                <div class="staff-item clickable" onclick="window.eventManager.showStaffSchedule(${JSON.stringify(person).replace(/"/g, '&quot;')})">
                    <div class="staff-info">
                        <strong>${person.name}</strong>
                    </div>
                    <span class="status-${currentStatus.toLowerCase()}">${currentStatus}</span>
                </div>
            `;
        });

        html += `</div></div>`;
        document.getElementById('staffResults').innerHTML = html;
    }

    showNoStaffResults(query) {
        document.getElementById('staffResults').innerHTML = `
            <div class="no-results">
                <div class="placeholder-icon">❌</div>
                <h3>No staff found</h3>
                <p>No staff member named "${query}" found</p>
            </div>
        `;
    }

    clearStaffResults() {
        document.getElementById('staffResults').innerHTML = `
            <div class="results-placeholder">
                <div class="placeholder-icon">👥</div>
                <h3>Search Staff or Location</h3>
                <p>Search for a staff member to see their full schedule, or filter by location to see all staff working there</p>
            </div>
        `;
    }

    handleStallholderSearch(query) {
        if (!this.stallholderData || query.length < 2) {
            this.clearStallholderResults();
            return;
        }

        const searchTerm = query.toLowerCase();
        const results = this.stallholderData.filter(stall => 
            stall.name.toLowerCase().includes(searchTerm)
        );

        this.displayStallholderResults(results);
    }

    showAllStallholders() {
        if (!this.stallholderData) return;
        
        this.showFullScreenStallholderList();
    }

    showFullScreenStallholderList() {
        const main = document.querySelector('.main-content');
        const originalContent = main.innerHTML;
        
        main.innerHTML = `
            <div class="fullscreen-stallholder-list">
                <div class="list-header">
                    <button class="back-button" onclick="window.eventManager.returnToMain()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"></path>
                        </svg>
                        Back
                    </button>
                    <h2>All Stallholders - ${this.currentLocation.charAt(0).toUpperCase() + this.currentLocation.slice(1)}</h2>
                    <input type="text" id="fullListSearch" class="search-input" placeholder="Search stallholders...">
                </div>
                <div class="stallholder-full-grid">
                    <div class="grid-header">
                        <span>Name</span>
                        <span>Stall #</span>
                        <span>Location</span>
                        <span>Group</span>
                    </div>
                    <div id="fullGridResults"></div>
                </div>
            </div>
        `;
        
        // Store original content for return
        this.originalMainContent = originalContent;
        
        this.displayFullStallholderGrid(this.stallholderData);
        this.setupFullListSearch();
    }

    returnToMain() {
        document.querySelector('.main-content').innerHTML = this.originalMainContent;
        this.setupEventListeners(); // Re-setup event listeners
    }

    displayFullStallholderGrid(stallholders) {
        const container = document.getElementById('fullGridResults');
        
        let html = '';
        stallholders.forEach(stall => {
            html += `
                <div class="stallholder-full-row" onclick="window.eventManager.showStallholderModal(${stall.stallNumber})">
                    <span>${stall.name}</span>
                    <span>${stall.stallNumber}</span>
                    <span>${stall.location}</span>
                    <span>${stall.group}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    setupFullListSearch() {
        document.getElementById('fullListSearch').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            
            if (query.length === 0) {
                this.displayFullStallholderGrid(this.stallholderData);
                return;
            }
            
            const filtered = this.stallholderData.filter(stall => 
                stall.name.toLowerCase().includes(query) ||
                stall.location.toLowerCase().includes(query) ||
                stall.group.toLowerCase().includes(query) ||
                stall.stallNumber.toString().includes(query)
            );
            
            this.displayFullStallholderGrid(filtered);
        });
    }

    displayStallholderResults(results) {
        const container = document.getElementById('stallholderResults');
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <div class="placeholder-icon">❌</div>
                    <p>No stallholders found</p>
                </div>
            `;
            return;
        }

        let html = '<div class="stallholder-search-results">';
        results.forEach(stall => {
            html += `
                <div class="stallholder-item" onclick="window.eventManager.showStallholderModal(${stall.stallNumber})">
                    <div class="stallholder-info">
                        <strong>${stall.name}</strong>
                        <small>Stall #${stall.stallNumber} - ${stall.location}</small>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }

    clearStallholderResults() {
        document.getElementById('stallholderResults').innerHTML = `
            <div class="results-placeholder">
                <div class="placeholder-icon">🏪</div>
                <p>Type to search stallholders or view complete list</p>
            </div>
        `;
    }

    showStallholderModal(stallNumber) {
        const stall = this.stallholderData.find(s => s.stallNumber === stallNumber);
        if (!stall) return;

        document.getElementById('modalStallName').textContent = stall.name;
        document.getElementById('modalStallNumber').textContent = stall.stallNumber;
        document.getElementById('modalStallLocation').textContent = stall.location;
        document.getElementById('modalStallGroup').textContent = stall.group;
        
        document.getElementById('stallModal').style.display = 'flex';
    }

    hideModal() {
        document.getElementById('stallModal').style.display = 'none';
    }

    handleEditStallholders() {
        const password = prompt('Enter admin password:');
        if (password === 'union2024') {
            // Pass current campus to the editor via URL parameter
            const editorUrl = `admin/stallholder-editor.html?campus=${this.currentLocation}`;
            window.open(editorUrl, '_blank');
        } else if (password !== null) {
            this.showToast('Incorrect password', 'error');
        }
    }

    clearResults() {
        this.clearStaffResults();
        this.clearStallholderResults();
        document.getElementById('staffSearch').value = '';
        document.getElementById('locationFilter').value = '';
        document.getElementById('stallholderSearch').value = '';
    }

    showLoading() {
        document.getElementById('loadingIndicator').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingIndicator').style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('toast-show'), 10);
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }
}
// Simple refresh function - no animations, just works

async function refreshAppData() {
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (!refreshBtn) return;
    
    // Disable button during refresh
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    
    try {
        // Clear any existing caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter(name => name.includes('data'))
                    .map(name => caches.delete(name))
            );
        }
        
        // Force reload the app data
        if (window.eventManager) {
            await window.eventManager.loadData();
            window.eventManager.showToast('Data refreshed!', 'success');
        } else {
            // Fallback: reload page
            window.location.reload();
        }
        
    } catch (error) {
        console.error('Refresh failed:', error);
        // Fallback: reload page
        window.location.reload();
    } finally {
        // Reset button
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            <span>Refresh</span>
        `;
    }
}

// Set up refresh button when page loads
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAppData);
        
        // Add touch event for better mobile response
        refreshBtn.addEventListener('touchstart', function() {
            this.style.background = 'var(--brilliant-green)';
            this.style.color = 'var(--union-black)';
        });
        
        refreshBtn.addEventListener('touchend', function() {
            setTimeout(() => {
                if (!this.disabled) {
                    this.style.background = 'transparent';
                    this.style.color = 'var(--text-primary)';
                }
            }, 150);
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    window.eventManager = new UnionEventManager();
});
// Add this to your script.js file

class VersionManager {
    constructor() {
        this.currentVersion = '3.3.0'; // Update this when you change sw.js version
        this.init();
    }
    
    async init() {
        this.updateVersionDisplay();
        await this.checkServiceWorkerVersion();
        this.updateLastUpdatedTime();
    }
    
    updateVersionDisplay() {
        const versionElement = document.getElementById('appVersion');
        if (versionElement) {
            versionElement.textContent = `v${this.currentVersion}`;
        }
    }
    
    async checkServiceWorkerVersion() {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                // Try to get version from service worker
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data && event.data.version) {
                        const versionElement = document.getElementById('appVersion');
                        if (versionElement) {
                            versionElement.textContent = `v${event.data.version}`;
                        }
                    }
                };
                
                navigator.serviceWorker.controller.postMessage(
                    { type: 'GET_VERSION' },
                    [messageChannel.port2]
                );
            }
        } catch (error) {
            console.log('Could not get SW version:', error);
        }
    }
    
    updateLastUpdatedTime() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        if (lastUpdatedElement) {
            const now = new Date();
            const timeString = now.toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            lastUpdatedElement.textContent = `Updated: ${timeString}`;
        }
    }
    
    // Call this when data is refreshed
    onDataRefresh() {
        this.updateLastUpdatedTime();
    }
}

// Initialize version manager
document.addEventListener('DOMContentLoaded', () => {
    window.versionManager = new VersionManager();
});

// Update the refresh function to show when data was last refreshed
const originalRefreshAppData = refreshAppData;
refreshAppData = async function() {
    await originalRefreshAppData();
    if (window.versionManager) {
        window.versionManager.onDataRefresh();
    }
};
