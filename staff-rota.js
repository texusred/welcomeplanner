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
            this.initializeChristmasFeature();
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
            const data = await response.json();
            
            // Validate data structure
            if (!data || !data.staff || !Array.isArray(data.staff)) {
                throw new Error('Invalid rota data structure');
            }
            
            this.rotaData = this.validateAndSanitizeRotaData(data);
            this.dataLoaded = true;
            this.hideLoading();
        } catch (error) {
            console.error('Error loading rota data:', error);
            this.hideLoading();
            this.showToast('Failed to load rota data. Please check your connection.', 'error');
            throw error;
        }
    }

    validateAndSanitizeRotaData(data) {
        // Sanitize staff data
        const sanitizedStaff = data.staff.map(person => {
            if (!person || typeof person !== 'object') return null;
            
            const name = this.sanitizeString(person.name || '');
            if (!name) return null;
            
            const schedule = Array.isArray(person.schedule) ? person.schedule.map(slot => {
                if (!slot || typeof slot !== 'object') return null;
                
                return {
                    timeSlot: this.sanitizeString(slot.timeSlot || ''),
                    task: this.sanitizeString(slot.task || ''),
                    taskName: this.sanitizeString(slot.taskName || '')
                };
            }).filter(slot => slot !== null) : [];
            
            return { name, schedule };
        }).filter(person => person !== null);
        
        return {
            ...data,
            staff: sanitizedStaff
        };
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, ''); // Basic sanitization
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

        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
            if (e.target.classList.contains('christmas-modal')) {
                this.closeChristmasModal();
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal[style*="flex"]');
                if (openModal) {
                    this.closeModal(openModal.id);
                }
                const christmasModal = document.getElementById('christmasModal');
                if (christmasModal && christmasModal.style.display === 'flex') {
                    this.closeChristmasModal();
                }
            }
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
        const results = this.findStaffByTaskAtCurrentTime(selectedTask, currentTime);

        this.displayTaskResults(selectedTask, results, currentTime);
    }

    findStaffByTaskAtCurrentTime(taskName, currentTime) {
        const staffAssigned = [];

        this.rotaData.staff.forEach(person => {
            person.schedule.forEach(slot => {
                if (slot.taskName === taskName) {
                    // Check if the time slot contains the current time
                    if (this.timeSlotContainsTime(slot.timeSlot, currentTime)) {
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
        const modalTitle = document.getElementById('taskModalTitle');
        const modalBody = document.getElementById('taskModalBody');

        modalTitle.textContent = `${taskName} (Now)`;

        // Clear previous content
        modalBody.innerHTML = '';

        if (results.length === 0) {
            const noAssignmentDiv = document.createElement('div');
            noAssignmentDiv.className = 'no-assignment';
            
            const strongEl = document.createElement('strong');
            strongEl.textContent = `No staff currently assigned to ${taskName}`;
            
            const pEl = document.createElement('p');
            pEl.textContent = 'This may indicate a coverage gap that needs attention.';
            
            noAssignmentDiv.appendChild(strongEl);
            noAssignmentDiv.appendChild(pEl);
            modalBody.appendChild(noAssignmentDiv);
        } else {
            const staffCountDiv = document.createElement('div');
            staffCountDiv.className = 'staff-count';
            staffCountDiv.textContent = `${results.length} staff member${results.length !== 1 ? 's' : ''} currently assigned`;
            modalBody.appendChild(staffCountDiv);
            
            const taskResultsDiv = document.createElement('div');
            taskResultsDiv.className = 'task-results';

            results.forEach(staff => {
                const staffItemDiv = document.createElement('div');
                staffItemDiv.className = 'staff-item';
                
                const nameDiv = document.createElement('div');
                nameDiv.className = 'staff-name';
                nameDiv.textContent = staff.name;
                
                const timeDiv = document.createElement('div');
                timeDiv.className = 'staff-time';
                timeDiv.textContent = staff.timeSlot;
                
                staffItemDiv.appendChild(nameDiv);
                staffItemDiv.appendChild(timeDiv);
                taskResultsDiv.appendChild(staffItemDiv);
            });

            modalBody.appendChild(taskResultsDiv);
        }

        this.showModal('taskModal');
    }

    searchByPerson() {
        const staffSearch = document.getElementById('staffSearch');
        const staffName = this.sanitizeString(staffSearch.value);

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
        const modalTitle = document.getElementById('personModalTitle');
        const modalBody = document.getElementById('personModalBody');

        modalTitle.textContent = `${person.name}'s Schedule`;

        // Add status to each schedule item based on current time
        const scheduleWithStatus = person.schedule.map(slot => ({
            ...slot,
            status: this.getSlotStatus(slot.timeSlot, currentTime)
        }));

        // Sort by time slot
        scheduleWithStatus.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

        // Find current, next, and upcoming items
        const currentItem = scheduleWithStatus.find(s => s.status === 'current');
        const upcomingItems = scheduleWithStatus.filter(s => s.status === 'upcoming').slice(0, 2);

        // Clear previous content
        modalBody.innerHTML = '';
        
        const personScheduleDiv = document.createElement('div');
        personScheduleDiv.className = 'person-schedule';

        // Current activity
        if (currentItem) {
            personScheduleDiv.appendChild(this.createScheduleItem(currentItem, 'NOW', 'current'));
        }

        // Next activities
        upcomingItems.forEach((item, index) => {
            const label = index === 0 ? 'NEXT' : 'THEN';
            personScheduleDiv.appendChild(this.createScheduleItem(item, label, 'upcoming'));
        });

        // If no current activity, show some context
        if (!currentItem && upcomingItems.length === 0) {
            const recentPast = scheduleWithStatus.filter(s => s.status === 'past').slice(-1);
            if (recentPast.length > 0) {
                personScheduleDiv.appendChild(this.createScheduleItem(recentPast[0], 'RECENTLY', 'break'));
            } else {
                const scheduleItemDiv = document.createElement('div');
                scheduleItemDiv.className = 'schedule-item break';
                
                const iconDiv = document.createElement('div');
                iconDiv.className = 'schedule-icon break';
                
                const detailsDiv = document.createElement('div');
                detailsDiv.className = 'schedule-details';
                
                const labelDiv = document.createElement('div');
                labelDiv.className = 'schedule-label';
                labelDiv.textContent = 'CURRENT';
                
                const taskDiv = document.createElement('div');
                taskDiv.className = 'schedule-task';
                taskDiv.textContent = 'No current assignment';
                
                const timeDiv = document.createElement('div');
                timeDiv.className = 'schedule-time';
                timeDiv.textContent = 'Free time';
                
                detailsDiv.appendChild(labelDiv);
                detailsDiv.appendChild(taskDiv);
                detailsDiv.appendChild(timeDiv);
                
                scheduleItemDiv.appendChild(iconDiv);
                scheduleItemDiv.appendChild(detailsDiv);
                
                personScheduleDiv.appendChild(scheduleItemDiv);
            }
        }

        modalBody.appendChild(personScheduleDiv);
        this.showModal('personModal');
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
        
        const scheduleItemDiv = document.createElement('div');
        scheduleItemDiv.className = `schedule-item ${itemClass}`;
        
        const iconDiv = document.createElement('div');
        iconDiv.className = `schedule-icon ${itemClass}`;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'schedule-details';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'schedule-label';
        labelDiv.textContent = label;
        
        const taskDiv = document.createElement('div');
        taskDiv.className = 'schedule-task';
        taskDiv.textContent = item.taskName;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'schedule-time';
        timeDiv.textContent = item.timeSlot;
        
        detailsDiv.appendChild(labelDiv);
        detailsDiv.appendChild(taskDiv);
        detailsDiv.appendChild(timeDiv);
        
        scheduleItemDiv.appendChild(iconDiv);
        scheduleItemDiv.appendChild(detailsDiv);
        
        return scheduleItemDiv;
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus management for accessibility
        setTimeout(() => {
            const closeButton = modal.querySelector('.modal-close');
            if (closeButton) {
                closeButton.focus();
            }
        }, 100);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    showNoResults() {
        document.getElementById('noResults').style.display = 'block';
        document.getElementById('noResults').scrollIntoView({ behavior: 'smooth' });
        
        // Hide after 5 seconds
        setTimeout(() => {
            document.getElementById('noResults').style.display = 'none';
        }, 5000);
    }

    // Christmas Easter Egg Functions
    initializeChristmasFeature() {
        // Calculate days until Christmas on page load
        const daysUntil = this.calculateDaysUntilChristmas();
        document.getElementById('daysUntilChristmas').textContent = daysUntil;
        
        // Check Christmas button visibility
        this.updateChristmasButtonVisibility();
        
        // Update button visibility every minute
        setInterval(() => {
            this.updateChristmasButtonVisibility();
        }, 60000);
    }

    calculateDaysUntilChristmas() {
        const today = new Date();
        const currentYear = today.getFullYear();
        let christmas = new Date(currentYear, 11, 25); // December 25th
        
        // If Christmas has passed this year, calculate for next year
        if (today > christmas) {
            christmas = new Date(currentYear + 1, 11, 25);
        }
        
        const timeDiff = christmas.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        return daysDiff;
    }

    isChristmasButtonTime() {
        const now = new Date();
        const minutes = now.getMinutes();
        
        // Show button between 45 minutes past and on the hour (45-59 minutes)
        return minutes >= 45;
    }

    updateChristmasButtonVisibility() {
        const button = document.querySelector('.christmas-button');
        if (button) {
            if (this.isChristmasButtonTime()) {
                button.style.display = 'flex';
            } else {
                button.style.display = 'none';
            }
        }
    }

    startSnowfall() {
        const snowflakesContainer = document.getElementById('snowflakesContainer');
        if (snowflakesContainer) {
            snowflakesContainer.style.display = 'block';
        }
    }

    stopSnowfall() {
        const snowflakesContainer = document.getElementById('snowflakesContainer');
        if (snowflakesContainer) {
            snowflakesContainer.style.display = 'none';
        }
    }

    showChristmasModal() {
        const daysUntil = this.calculateDaysUntilChristmas();
        document.getElementById('daysUntilChristmas').textContent = daysUntil;
        document.getElementById('christmasModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this.startSnowfall();
    }

    closeChristmasModal() {
        document.getElementById('christmasModal').style.display = 'none';
        document.body.style.overflow = '';
        this.stopSnowfall();
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

// Global functions for modal controls (called from HTML)
function closeModal(modalId) {
    if (window.staffRota) {
        window.staffRota.closeModal(modalId);
    }
}

function showChristmasModal() {
    if (window.staffRota) {
        window.staffRota.showChristmasModal();
    }
}

function closeChristmasModal() {
    if (window.staffRota) {
        window.staffRota.closeChristmasModal();
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