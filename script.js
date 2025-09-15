class UnionEventManager {
    constructor() {
        this.currentLocation = 'cambridge'; // Fixed to cambridge only
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
                fetch(`data/cambridge-staff-rota.json`),
                fetch(`data/cambridge-stallholders.json`)
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

        return data.map(stall => {
            if (!stall || typeof stall !== 'object') return null;
            
            const name = this.sanitizeString(stall.name || '');
            const location = this.sanitizeString(stall.location || '');
            const group = this.sanitizeString(stall.group || '');
            const stallNumber = parseInt(stall.stallNumber) || 0;

            if (!name || stallNumber <= 0) return null;

            return { name, stallNumber, location, group };
        }).filter(Boolean);
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, '');
    }

    setupEventListeners() {
        // Staff search
        const staffSearchInput = document.getElementById('staffSearch');
        if (staffSearchInput) {
            staffSearchInput.addEventListener('input', (e) => {
                this.handleStaffSearch(e.target.value);
            });
        }

        // Location filter
        const locationFilter = document.getElementById('locationFilter');
        if (locationFilter) {
            locationFilter.addEventListener('change', (e) => {
                this.handleLocationFilter(e.target.value);
            });
        }

        // Stallholder search
        const stallholderSearchInput = document.getElementById('stallholderSearch');
        if (stallholderSearchInput) {
            stallholderSearchInput.addEventListener('input', (e) => {
                this.handleStallholderSearch(e.target.value);
            });
        }

        // List all stallholders
        const listAllBtn = document.getElementById('listAllStallholders');
        if (listAllBtn) {
            listAllBtn.addEventListener('click', () => {
                this.showAllStallholders();
            });
        }

        // Edit stallholders with password
        const editBtn = document.getElementById('editStallholdersBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.handleEditStallholders();
            });
        }

        // Modal functionality
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.hideModal();
            });
        }

        const stallModal = document.getElementById('stallModal');
        if (stallModal) {
            stallModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    this.hideModal();
                }
            });
        }
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
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = timeStr;
        }
        this.currentTime = now;
    }

    updateLocationDisplay() {
        document.title = `Staff Rota & Event Management - Cambridge | UNION`;
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

        // Update location names for display
        const displayLocation = this.updateLocationName(location);

        const staffAtLocation = this.staffData.staff.filter(person => 
            person.schedule.some(slot => {
                const updatedTaskName = this.updateLocationName(slot.taskName);
                return updatedTaskName === displayLocation;
            })
        );

        this.showLocationStaff(displayLocation, staffAtLocation);
    }

    updateLocationName(taskName) {
        // Convert old names to new names
        if (taskName === 'SU Stall - Freebies Left Counter') {
            return 'SU Stall - Freebies LAB Courtyard';
        }
        if (taskName === 'SU Stall - Freebies Right Counter') {
            return 'SU Stall - Freebies Ruskin Courtyard';
        }
        return taskName;
    }

    showStaffSchedule(person) {
        // Find current active shift
        const currentShift = person.schedule.find(slot => 
            this.getShiftStatus(slot.timeSlot) === 'ACTIVE'
        );

        let scheduleHTML = `
            <div class="staff-schedule">
                <div class="staff-name">${person.name}</div>
        `;

        // Add current status banner
        if (currentShift) {
            const updatedTaskName = this.updateLocationName(currentShift.taskName);
            const [startTime, endTime] = currentShift.timeSlot.split('-');
            scheduleHTML += `
                <div class="current-status">
                    🟢 Currently: ${updatedTaskName}
                    <div class="status-time">Ends at ${endTime}</div>
                </div>
            `;
        } else {
            // Find next shift
            const nextShift = person.schedule.find(slot => 
                this.getShiftStatus(slot.timeSlot) === 'Upcoming'
            );
            if (nextShift) {
                const [startTime] = nextShift.timeSlot.split('-');
                const updatedTaskName = this.updateLocationName(nextShift.taskName);
                scheduleHTML += `
                    <div class="current-status off">
                        ⚪ Currently: Off Shift
                        <div class="status-time">Next: ${updatedTaskName} at ${startTime}</div>
                    </div>
                `;
            } else {
                scheduleHTML += `
                    <div class="current-status off">
                        ⚪ Currently: Off Shift
                    </div>
                `;
            }
        }

        // Add schedule items
        person.schedule.forEach(slot => {
            const status = this.getShiftStatus(slot.timeSlot);
            const statusClass = status.toLowerCase().replace(' ', '-');
            const updatedTaskName = this.updateLocationName(slot.taskName);
            
            let statusBadge = '';
            if (status === 'ACTIVE') {
                statusBadge = '<div class="status-badge active">ACTIVE</div>';
            } else if (status === 'Complete') {
                statusBadge = '<div class="status-badge completed">✓</div>';
            } else if (slot === person.schedule.find(s => this.getShiftStatus(s.timeSlot) === 'Upcoming')) {
                statusBadge = '<div class="status-badge next">Next</div>';
            }
            
            scheduleHTML += `
                <div class="schedule-item ${statusClass}">
                    <div class="time-slot">${slot.timeSlot}</div>
                    <div class="task-name">${updatedTaskName}</div>
                    ${statusBadge}
                </div>
            `;
        });

        scheduleHTML += `</div>`;
        const resultsElement = document.getElementById('staffResults');
        if (resultsElement) {
            resultsElement.innerHTML = scheduleHTML;
        }
    }

    showLocationStaff(location, staffList) {
        let html = `
            <div class="location-staff">
                <h4>Staff at: ${location}</h4>
                <div class="staff-list">
        `;

        staffList.forEach(person => {
            const shifts = person.schedule
                .filter(slot => {
                    const updatedTaskName = this.updateLocationName(slot.taskName);
                    return updatedTaskName === location;
                })
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
        const resultsElement = document.getElementById('staffResults');
        if (resultsElement) {
            resultsElement.innerHTML = html;
        }
    }

    getShiftStatus(timeSlot) {
        const [startTime, endTime] = timeSlot.split('-');
        const currentTime = this.currentTime.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        if (currentTime >= startTime && currentTime < endTime) {
            return 'ACTIVE';
        } else if (startTime > currentTime) {
            return 'Upcoming';
        } else {
            return 'Complete';
        }
    }

    getPersonCurrentStatus(person) {
        for (let slot of person.schedule) {
            const status = this.getShiftStatus(slot.timeSlot);
            if (status === 'ACTIVE') {
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
        const resultsElement = document.getElementById('staffResults');
        if (resultsElement) {
            resultsElement.innerHTML = html;
        }
    }

    showNoStaffResults(query) {
        const resultsElement = document.getElementById('staffResults');
        if (resultsElement) {
            resultsElement.innerHTML = `
                <div class="no-results">
                    <div class="placeholder-icon">❌</div>
                    <h3>No staff found</h3>
                    <p>No staff member named "${query}" found</p>
                </div>
            `;
        }
    }

    clearStaffResults() {
        const resultsElement = document.getElementById('staffResults');
        if (resultsElement) {
            resultsElement.innerHTML = `
                <div class="results-placeholder">
                    <div class="placeholder-icon">👥</div>
                    <h3>Search Staff or Location</h3>
                    <p>Search for a staff member to see their full schedule, or filter by location to see all staff working there</p>
                </div>
            `;
        }
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
                    <h2>All Stallholders - Cambridge</h2>
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
        const mainContent = document.querySelector('.main-content');
        if (mainContent && this.originalMainContent) {
            mainContent.innerHTML = this.originalMainContent;
            this.setupEventListeners(); // Re-setup event listeners
        }
    }

    displayFullStallholderGrid(stallholders) {
        const container = document.getElementById('fullGridResults');
        if (!container) return;
        
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
        const searchInput = document.getElementById('fullListSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
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
    }

    displayStallholderResults(results) {
        const container = document.getElementById('stallholderResults');
        if (!container) return;
        
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
        const container = document.getElementById('stallholderResults');
        if (container) {
            container.innerHTML = `
                <div class="results-placeholder">
                    <div class="placeholder-icon">🏪</div>
                    <p>Type to search stallholders or view complete list</p>
                </div>
            `;
        }
    }

    showStallholderModal(stallNumber) {
        const stall = this.stallholderData.find(s => s.stallNumber === stallNumber);
        if (!stall) return;

        const elements = {
            name: document.getElementById('modalStallName'),
            number: document.getElementById('modalStallNumber'),
            location: document.getElementById('modalStallLocation'),
            group: document.getElementById('modalStallGroup'),
            modal: document.getElementById('stallModal')
        };

        if (elements.name) elements.name.textContent = stall.name;
        if (elements.number) elements.number.textContent = stall.stallNumber;
        if (elements.location) elements.location.textContent = stall.location;
        if (elements.group) elements.group.textContent = stall.group;
        if (elements.modal) elements.modal.style.display = 'flex';
    }

    hideModal() {
        const modal = document.getElementById('stallModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    handleEditStallholders() {
        const password = prompt('Enter admin password:');
        if (password === 'union2024') {
            window.open('admin/stallholder-editor.html?campus=cambridge', '_blank');
        } else if (password !== null) {
            this.showToast('Incorrect password', 'error');
        }
    }

    clearResults() {
        this.clearStaffResults();
        this.clearStallholderResults();
        
        const staffSearch = document.getElementById('staffSearch');
        const locationFilter = document.getElementById('locationFilter');
        const stallholderSearch = document.getElementById('stallholderSearch');
        
        if (staffSearch) staffSearch.value = '';
        if (locationFilter) locationFilter.value = '';
        if (stallholderSearch) stallholderSearch.value = '';
    }

    showLoading() {
        const loading = document.getElementById('loadingIndicator');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loadingIndicator');
        if (loading) {
            loading.style.display = 'none';
        }
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

// Refresh function
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

// Version Management
class VersionManager {
    constructor() {
        this.currentVersion = '3.9.0';
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
    
    onDataRefresh() {
        this.updateLastUpdatedTime();
    }
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    window.eventManager = new UnionEventManager();
    window.versionManager = new VersionManager();
});

// Update refresh function to update timestamp
const originalRefreshAppData = refreshAppData;
refreshAppData = async function() {
    await originalRefreshAppData();
    if (window.versionManager) {
        window.versionManager.onDataRefresh();
    }
};
// Map viewer functions
function openMap(mapId) {
    const modal = document.getElementById('mapModal');
    const img = document.getElementById('modalImage');
    
    // Replace with your actual image paths
    img.src = `maps/${mapId}.jpg`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMap() {
    document.getElementById('mapModal').classList.remove('active');
    document.body.style.overflow = '';
}

// Add these event listeners to your existing DOMContentLoaded section
document.addEventListener('click', function(e) {
    if (e.target.id === 'mapModal') {
        closeMap();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMap();
});
