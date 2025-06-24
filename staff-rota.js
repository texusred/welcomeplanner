// Staff Rota - ARU Students' Union
// Quick lookup for staff schedules and task assignments

class StaffRota {
    constructor() {
        this.rotaData = null;
        this.currentTime = new Date();
        this.dataLoaded = false;
        this.selectedTaskTime = null;
        this.selectedPersonTime = null;
        this.currentTask = null;
        this.currentPerson = null;
        
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
        document.getElementById('taskSelect').addEventListener('change', (e) => {
            this.handleTaskSelection(e.target.value);
        });

        document.getElementById('searchTaskBtn').addEventListener('click', () => {
            this.searchByTask();
        });

        // Task time selection
        document.getElementById('updateTaskSearch').addEventListener('click', () => {
            this.updateTaskSearch();
        });

        // Person search
        document.getElementById('staffSearch').addEventListener('input', (e) => {
            this.handlePersonInput(e.target.value);
        });

        document.getElementById('searchPersonBtn').addEventListener('click', () => {
            this.searchByPerson();
        });

        // Person time selection
        document.getElementById('updatePersonSearch').addEventListener('click', () => {
            this.updatePersonSearch();
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
                    // Don't auto-search, just show time selector
                    this.handlePersonInput(e.target.value);
                }
            }, 500);
        });
    }

    handleTaskSelection(taskValue) {
        this.currentTask = taskValue;
        const timeSelector = document.getElementById('taskTimeSelector');
        
        if (taskValue) {
            timeSelector.style.display = 'block';
            // Reset time selection
            document.getElementById('taskTimeSelect').value = '';
            this.selectedTaskTime = null;
        } else {
            timeSelector.style.display = 'none';
            this.selectedTaskTime = null;
        }
    }

    handlePersonInput(personValue) {
        this.currentPerson = personValue.trim();
        const timeSelector = document.getElementById('personTimeSelector');
        
        if (personValue.trim()) {
            timeSelector.style.display = 'block';
            // Reset time selection
            document.getElementById('personTimeSelect').value = '';
            this.selectedPersonTime = null;
        } else {
            timeSelector.style.display = 'none';
            this.selectedPersonTime = null;
        }
    }

    updateTaskSearch() {
        this.selectedTaskTime = document.getElementById('taskTimeSelect').value;
        this.searchByTask();
    }

    updatePersonSearch() {
        this.selectedPersonTime = document.getElementById('personTimeSelect').value;
        this.searchByPerson();
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

    getEffectiveSearchTime() {
        // For task search, use selectedTaskTime; for person search, use selectedPersonTime
        const selectedTime = this.selectedTaskTime || this.selectedPersonTime;
        return selectedTime || this.formatTime(this.currentTime);
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

        const searchTime = this.getEffectiveSearchTime();
        const results = this.findStaffByTaskAtTime(selectedTask, searchTime);

        if (results.length === 0) {
            this.showNoResults();
            return;
        }

        this.displayTaskResults(selectedTask, results, searchTime);
    }

    findStaffByTaskAtTime(taskName, searchTime) {
        const staffAssigned = [];

        this.rotaData.staff.forEach(person => {
            person.schedule.forEach(slot => {
                if (slot.taskName === taskName) {
                    // Check if the time slot contains the search time
                    if (this.timeSlotContainsTime(slot.timeSlot, searchTime)) {
                        staffAssigned.push({
                            name: person.name,
                            timeSlot: slot.timeSlot,
                            task: slot.taskName
                        });
                    }
                }
            });
        });

        // Sort by name for consistent display
        staffAssigned.sort((a, b) => a.name.localeCompare(b.name));

        return staffAssigned;
    }

    timeSlotContainsTime(timeSlot, searchTime) {
        const { start, end } = this.parseTimeSlot(timeSlot);
        
        // Convert times to minutes for comparison
        const searchMinutes = this.timeToMinutes(searchTime);
        const startMinutes = this.timeToMinutes(start);
        const endMinutes = this.timeToMinutes(end);
        
        return searchMinutes >= startMinutes && searchMinutes < endMinutes;
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    displayTaskResults(taskName, results, searchTime) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsTitle = document.getElementById('resultsTitle');
        const resultsContent = document.getElementById('resultsContent');

        const timeDisplay = this.selectedTaskTime ? ` at ${searchTime}` : ' (current time)';
        resultsTitle.textContent = `${taskName}${timeDisplay}`;

        let html = '';

        if (results.length === 0) {
            html = `
                <div class="no-assignment">
                    <p><strong>No staff assigned to ${taskName} at ${searchTime}</strong></p>
                    <p>This may indicate a coverage gap that needs attention.</p>
                </div>
            `;
        } else {
            html = `
                <div class="staff-assignment">
                    <div class="assignment-header">
                        <strong>${results.length} staff member${results.length !== 1 ? 's' : ''} assigned</strong>
                    </div>
                    <div class="staff-list">
            `;

            results.forEach(staff => {
                html += `
                    <div class="staff-item">
                        <div class="staff-name">${staff.name}</div>
                        <div class="staff-time">${staff.timeSlot}</div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        resultsContent.innerHTML = html;
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Hide no results section
        document.getElementById('noResults').style.display = 'none';
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

        const searchTime = this.getEffectiveSearchTime();
        this.displayPersonResults(person, searchTime);
    }

    findPersonByName(searchName) {
        const normalizedSearch = searchName.toLowerCase().trim();
        
        return this.rotaData.staff.find(person => {
            const normalizedName = person.name.toLowerCase();
            return normalizedName.includes(normalizedSearch) || 
                   normalizedSearch.includes(normalizedName);
        });
    }

    displayPersonResults(person, searchTime) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsTitle = document.getElementById('resultsTitle');
        const resultsContent = document.getElementById('resultsContent');

        const timeDisplay = this.selectedPersonTime ? ` (checking ${searchTime})` : '';
        resultsTitle.textContent = `${person.name}'s Schedule${timeDisplay}`;

        // Add status to each schedule item based on search time
        const scheduleWithStatus = person.schedule.map(slot => ({
            ...slot,
            status: this.getSlotStatus(slot.timeSlot, searchTime)
        }));

        // Sort by time slot
        scheduleWithStatus.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

        let html = '<div class="person-schedule">';

        if (this.selectedPersonTime) {
            // Show specific time results
            const currentSlot = scheduleWithStatus.find(s => 
                this.timeSlotContainsTime(s.timeSlot, searchTime)
            );

            if (currentSlot) {
                html += this.createScheduleItem(currentSlot, 'AT THIS TIME', 'current');
            } else {
                html += `
                    <div class="schedule-item break">
                        <div class="schedule-icon break"></div>
                        <div class="schedule-details">
                            <div class="schedule-label">AT THIS TIME</div>
                            <div class="schedule-task">No assignment</div>
                            <div class="schedule-time">${searchTime}</div>
                        </div>
                    </div>
                `;
            }

            // Show surrounding context
            const contextSlots = scheduleWithStatus.filter(s => {
                const slotStart = this.timeToMinutes(this.parseTimeSlot(s.timeSlot).start);
                const searchMinutes = this.timeToMinutes(searchTime);
                return Math.abs(slotStart - searchMinutes) <= 120; // Within 2 hours
            }).slice(0, 3);

            contextSlots.forEach(item => {
                if (!this.timeSlotContainsTime(item.timeSlot, searchTime)) {
                    html += this.createScheduleItem(item, 'CONTEXT', 'upcoming');
                }
            });

        } else {
            // Show current time logic (now, next, then)
            const currentItem = scheduleWithStatus.find(s => s.status === 'current');
            const upcomingItems = scheduleWithStatus.filter(s => s.status === 'upcoming').slice(0, 2);

            if (currentItem) {
                html += this.createScheduleItem(currentItem, 'NOW', 'current');
            }

            upcomingItems.forEach((item, index) => {
                const label = index === 0 ? 'NEXT' : 'THEN';
                html += this.createScheduleItem(item, label, 'upcoming');
            });

            // If no current activity, show some context
            if (!currentItem && upcomingItems.length === 0) {
                const recentPast = scheduleWithStatus.filter(s => s.status === 'past').slice(-1);
                if (recentPast.length > 0) {
                    html += this.createScheduleItem(recentPast[0], 'RECENTLY', 'break');
                }
            }
        }

        html += '</div>';

        resultsContent.innerHTML = html;
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Hide no results section
        document.getElementById('noResults').style.display = 'none';
    }

    getSlotStatus(timeSlot, currentTime) {
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
        
        // Hide time selectors
        document.getElementById('taskTimeSelector').style.display = 'none';
        document.getElementById('personTimeSelector').style.display = 'none';
        
        // Reset time selections
        this.selectedTaskTime = null;
        this.selectedPersonTime = null;
        this.currentTask = null;
        this.currentPerson = null;
        
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