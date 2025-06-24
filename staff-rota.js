// Staff Rota - ARU Students' Union
// Quick lookup for staff schedules and task assignments

class StaffRota {
    constructor() {
        this.rotaData = null;
        this.currentTime = new Date();
        this.dataLoaded = false;
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.startTimeUpdater();
            await this.loadRotaData();
            this.populateStaffList();
        } catch (error) {
            console.error('Failed to initialize staff rota:', error);
            this.showToast('Failed to load rota data. Please refresh the page.', 'error');
        }
    }

    async loadRotaData() {
        try {
            this.showLoading();
            const response = await fetch('data/staff-rota.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.rotaData = await response.json();
            this.dataLoaded = true;
            this.hideLoading();
        } catch (error) {
            console.error('Error loading rota data:', error);
            this.hideLoading();
            this.showToast('Failed to load rota data. Please check your connection.', 'error');
            throw error;
        }
    }

    setupEventListeners() {
        // Task search
        document.getElementById('searchTaskBtn').addEventListener('click', () => {
            this.searchByTask();
        });

        // Person search
        document.getElementById('searchPersonBtn').addEventListener('click', () => {
            this.searchByPerson();
        });

        // Enter key support
        document.getElementById('taskSelect').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.searchByTask();
            }
        });

        document.getElementById('staffSearch').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.searchByPerson();
            }
        });

        // Clear results
        document.getElementById('clearResults').addEventListener('click', () => {
            this.clearResults();
        });

        // Auto-search as user types (debounced)
        let searchTimeout;
        document.getElementById('staffSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (e.target.value.trim().length >= 2) {
                    this.searchByPerson();
                }
            }, 500);
        });
    }

    populateStaffList() {
        if (!this.rotaData) return;

        const datalist = document.getElementById('staffList');
        datalist.innerHTML = '';

        // Get unique staff names and sort them
        const staffNames = this.rotaData.staff
            .map(person => person.name)
            .sort((a, b) => a.localeCompare(b));

        staffNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            datalist.appendChild(option);
        });
    }

    startTimeUpdater() {
        this.updateCurrentTime();
        // Update every minute
        setInterval(() => {
            this.updateCurrentTime();
        }, 60000);
    }

    updateCurrentTime() {
        this.currentTime = new Date();
        const timeString = this.formatTime(this.currentTime);
        document.getElementById('currentTime').textContent = timeString;
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    parseTimeSlot(timeSlot) {
        const [start, end] = timeSlot.split('-');
        return { start, end };
    }

    getCurrentTimeSlot() {
        const now = this.formatTime(this.currentTime);
        const [hours, minutes] = now.split(':').map(Number);
        const currentMinutes = hours * 60 + minutes;

        return this.rotaData.timeSlots.find(slot => {
            const [slotHours, slotMinutes] = slot.split(':').map(Number);
            const slotMinutesTotal = slotHours * 60 + slotMinutes;
            
            // Find the slot that current time falls into
            const nextSlotIndex = this.rotaData.timeSlots.indexOf(slot) + 1;
            if (nextSlotIndex < this.rotaData.timeSlots.length) {
                const [nextHours, nextMinutes] = this.rotaData.timeSlots[nextSlotIndex].split(':').map(Number);
                const nextSlotMinutesTotal = nextHours * 60 + nextMinutes;
                return currentMinutes >= slotMinutesTotal && currentMinutes < nextSlotMinutesTotal;
            }
            return false;
        });
    }

    getTimeStatus(timeSlot, currentTime) {
        const { start, end } = this.parseTimeSlot(timeSlot);
        const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);

        const currentTotalMinutes = currentHours * 60 + currentMinutes;
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;

        if (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes) {
            return 'current';
        } else if (currentTotalMinutes < startTotalMinutes) {
            // Check if it's the next upcoming slot (within 2 hours)
            const timeDiff = startTotalMinutes - currentTotalMinutes;
            if (timeDiff <= 120) { // 2 hours = 120 minutes
                return 'upcoming';
            }
            return 'future';
        } else {
            return 'past';
        }
    }

    searchByTask() {
        const taskSelect = document.getElementById('taskSelect');
        const selectedTask = taskSelect.value;

        if (!selectedTask) {
            this.showToast('Please select a task first', 'warning');
            return;
        }

        if (!this.dataLoaded) {
            this.showToast('Data still loading, please wait...', 'info');
            return;
        }

        const currentTime = this.formatTime(this.currentTime);
        const results = this.findStaffByTask(selectedTask, currentTime);

        if (results.length === 0) {
            this.showNoResults();
            return;
        }

        this.displayTaskResults(selectedTask, results, currentTime);
    }

    findStaffByTask(taskName, currentTime) {
        const staffAssigned = [];

        this.rotaData.staff.forEach(person => {
            person.schedule.forEach(slot => {
                if (slot.taskName === taskName) {
                    const status = this.getTimeStatus(slot.timeSlot, currentTime);
                    staffAssigned.push({
                        name: person.name,
                        timeSlot: slot.timeSlot,
                        status: status,
                        task: slot.taskName
                    });
                }
            });
        });

        // Sort by status priority: current, upcoming, future, past
        const statusOrder = { current: 0, upcoming: 1, future: 2, past: 3 };
        staffAssigned.sort((a, b) => {
            const statusDiff = statusOrder[a.status] - statusOrder[b.status];
            if (statusDiff !== 0) return statusDiff;
            // If same status, sort by time slot
            return a.timeSlot.localeCompare(b.timeSlot);
        });

        return staffAssigned;
    }

    displayTaskResults(taskName, results, currentTime) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsTitle = document.getElementById('resultsTitle');
        const resultsContent = document.getElementById('resultsContent');

        resultsTitle.textContent = `${taskName} Staff`;

        // Group results by status
        const grouped = {
            current: results.filter(r => r.status === 'current'),
            upcoming: results.filter(r => r.status === 'upcoming'),
            future: results.filter(r => r.status === 'future'),
            past: results.filter(r => r.status === 'past')
        };

        let html = '';

        // Current staff
        if (grouped.current.length > 0) {
            html += this.createStatusGroup('On Duty Now', grouped.current, 'active');
        }

        // Upcoming staff
        if (grouped.upcoming.length > 0) {
            html += this.createStatusGroup('Coming Up Soon', grouped.upcoming, 'upcoming');
        }

        // Future staff (show only next few)
        if (grouped.future.length > 0) {
            const nextFew = grouped.future.slice(0, 3);
            html += this.createStatusGroup('Later Today', nextFew, 'upcoming');
        }

        // If no current or upcoming, show some past for context
        if (grouped.current.length === 0 && grouped.upcoming.length === 0 && grouped.past.length > 0) {
            const recentPast = grouped.past.slice(-2);
            html += this.createStatusGroup('Recently Finished', recentPast, 'break');
        }

        resultsContent.innerHTML = html;
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Hide no results section
        document.getElementById('noResults').style.display = 'none';
    }

    createStatusGroup(title, items, iconClass) {
        if (items.length === 0) return '';

        let html = `
            <div class="status-group">
                <div class="status-header">
                    <div class="status-icon ${iconClass}"></div>
                    <div class="status-label">${title}</div>
                </div>
                <div class="staff-list">
        `;

        items.forEach(item => {
            html += `
                <div class="staff-item">
                    <div class="staff-name">${item.name}</div>
                    <div class="staff-time">${item.timeSlot}</div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    searchByPerson() {
        const staffSearch = document.getElementById('staffSearch');
        const staffName = staffSearch.value.trim();

        if (!staffName) {
            this.showToast('Please enter a staff name', 'warning');
            return;
        }

        if (!this.dataLoaded) {
            this.showToast('Data still loading, please wait...', 'info');
            return;
        }

        const person = this.findPersonByName(staffName);

        if (!person) {
            this.showNoResults();
            return;
        }

        const currentTime = this.formatTime(this.currentTime);
        this.displayPersonResults(person, currentTime);
    }

    findPersonByName(searchName) {
        const normalizedSearch = searchName.toLowerCase().trim();
        
        return this.rotaData.staff.find(person => {
            const normalizedName = person.name.toLowerCase();
            return normalizedName.includes(normalizedSearch) || 
                   normalizedSearch.includes(normalizedName);
        });
    }

    displayPersonResults(person, currentTime) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsTitle = document.getElementById('resultsTitle');
        const resultsContent = document.getElementById('resultsContent');

        resultsTitle.textContent = `${person.name}'s Schedule`;

        // Add status to each schedule item
        const scheduleWithStatus = person.schedule.map(slot => ({
            ...slot,
            status: this.getTimeStatus(slot.timeSlot, currentTime)
        }));

        // Sort by time slot
        scheduleWithStatus.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

        // Find current, next, and upcoming items
        const currentItem = scheduleWithStatus.find(s => s.status === 'current');
        const upcomingItems = scheduleWithStatus.filter(s => s.status === 'upcoming').slice(0, 3);
        const futureItems = scheduleWithStatus.filter(s => s.status === 'future').slice(0, 2);

        let html = '<div class="person-schedule">';

        // Current activity
        if (currentItem) {
            html += this.createScheduleItem(currentItem, 'NOW', 'current');
        }

        // Next activities
        upcomingItems.forEach((item, index) => {
            const label = index === 0 ? 'NEXT' : 'THEN';
            html += this.createScheduleItem(item, label, 'upcoming');
        });

        // Future activities
        futureItems.forEach(item => {
            html += this.createScheduleItem(item, 'LATER', 'future');
        });

        // If no current activity, show some context
        if (!currentItem && upcomingItems.length === 0) {
            const recentPast = scheduleWithStatus.filter(s => s.status === 'past').slice(-1);
            if (recentPast.length > 0) {
                html += this.createScheduleItem(recentPast[0], 'RECENTLY', 'break');
            }
        }

        html += '</div>';

        resultsContent.innerHTML = html;
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Hide no results section
        document.getElementById('noResults').style.display = 'none';
    }

    createScheduleItem(item, label, statusClass) {
        const isBreak = item.taskName === 'Lunch';
        const itemClass = isBreak ? 'break' : statusClass;
        
        return `
            <div class="schedule-item ${itemClass}">
                <div class="schedule-icon ${itemClass}"></div>
                <div class="schedule-details">
                    <div class="schedule-label">${label}</div>
                    <div class="schedule-task">${item.taskName}</div>
                    <div class="schedule-time">${item.timeSlot}</div>
                </div>
            </div>
        `;
    }

    showNoResults() {
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('noResults').style.display = 'block';
        document.getElementById('noResults').scrollIntoView({ behavior: 'smooth' });
    }

    clearResults() {
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';
        
        // Clear form inputs
        document.getElementById('taskSelect').value = '';
        document.getElementById('staffSearch').value = '';
        
        this.showToast('Results cleared', 'info');
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

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 4000);

        // Animate in
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);
    }

    // Utility methods for debugging
    getCurrentStatus() {
        const currentTime = this.formatTime(this.currentTime);
        console.log('Current time:', currentTime);
        console.log('Current time slot:', this.getCurrentTimeSlot());
        return {
            currentTime,
            fairStatus: this.getFairStatus(currentTime)
        };
    }

    getFairStatus(currentTime) {
        const [hours, minutes] = currentTime.split(':').map(Number);
        const currentMinutes = hours * 60 + minutes;
        
        const fairOpenMinutes = 10 * 60 + 30; // 10:30
        const fairCloseMinutes = 15 * 60; // 15:00

        if (currentMinutes < fairOpenMinutes) {
            return 'before';
        } else if (currentMinutes >= fairOpenMinutes && currentMinutes < fairCloseMinutes) {
            return 'open';
        } else {
            return 'closed';
        }
    }
}

// Initialize the staff rota when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.staffRota = new StaffRota();
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