// Stallholder Editor - ARU Students' Union
// Admin tool for managing stallholder data with location configuration and security enhancements

// Location configuration for different campuses
const LOCATION_CONFIG = {
    cambridge: ['Ruskin Courtyard', 'LAB Courtyard', 'Science Walkway'],
    chelmsford: ['Central Walkway']
};

class StallholderEditor {
    constructor() {
        this.stallholders = [];
        this.filteredStallholders = [];
        this.nextStallId = 1;
        this.currentCampus = 'cambridge'; // Default
        this.hasUnsavedChanges = false;
        
        this.init();
    }

    async init() {
        try {
            this.detectCampusFromURL();
            this.setupCampusSelector();
            await this.loadData();
            this.setupEventListeners();
            this.render();
            this.setupAutoSaveReminder();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showToast('Failed to load data. Please refresh the page.', 'error');
        }
    }

    detectCampusFromURL() {
        // Check URL parameter for campus
        const urlParams = new URLSearchParams(window.location.search);
        const campusParam = urlParams.get('campus');
        
        if (campusParam && LOCATION_CONFIG[campusParam]) {
            this.currentCampus = campusParam;
        }
        
        // Update campus selector to match if element exists
        const campusSelect = document.getElementById('campusSelect');
        if (campusSelect) {
            campusSelect.value = this.currentCampus;
        }
    }

    setupCampusSelector() {
        const campusSelect = document.getElementById('campusSelect');
        if (campusSelect) {
            campusSelect.addEventListener('change', async (e) => {
                if (this.hasUnsavedChanges) {
                    if (!confirm('You have unsaved changes. Switch campus anyway?')) {
                        e.target.value = this.currentCampus;
                        return;
                    }
                }
                this.currentCampus = e.target.value;
                await this.loadData();
                this.render();
            });
        }
    }

    async loadData() {
        try {
            this.showLoading();
            
            // Load from the correct campus-specific file
            const response = await fetch(`../data/${this.currentCampus}-stallholders.json`);
            if (!response.ok) throw new Error('Failed to fetch data');
            
            const data = await response.json();
            
            // Validate data structure
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format: expected array');
            }
            
            this.stallholders = this.validateAndSanitizeData(data);
            this.filteredStallholders = [...this.stallholders];
            this.nextStallId = Math.max(...this.stallholders.map(s => s.stallNumber || 0)) + 1;
            this.hasUnsavedChanges = false;
            
            this.hideLoading();
            this.updateTitle();
            this.updateLocationFilter();
        } catch (error) {
            this.hideLoading();
            this.showToast(`Failed to load ${this.currentCampus} data. Please check your connection.`, 'error');
            throw error;
        }
    }

    validateAndSanitizeData(data) {
        const validLocations = LOCATION_CONFIG[this.currentCampus] || [];
        
        return data.map(stall => {
            if (!stall || typeof stall !== 'object') {
                console.warn('Invalid stall object:', stall);
                return null;
            }
            
            const name = this.sanitizeString(stall.name || '');
            const location = this.sanitizeString(stall.location || '');
            const group = this.sanitizeString(stall.group || '');
            const stallNumber = parseInt(stall.stallNumber) || 0;
            
            if (!name || stallNumber <= 0) {
                console.warn('Invalid stall data:', { name, stallNumber });
                return null;
            }
            
            // Auto-migrate location data for current campus
            let validatedLocation = location;
            if (!validLocations.includes(location)) {
                // For Chelmsford, migrate any invalid location to Central Walkway
                if (this.currentCampus === 'chelmsford') {
                    validatedLocation = 'Central Walkway';
                    console.log(`Migrating location "${location}" to "Central Walkway" for ${name}`);
                } else {
                    // For Cambridge, default to Ruskin Courtyard if invalid
                    validatedLocation = validLocations.includes(location) ? location : 'Ruskin Courtyard';
                    if (location !== validatedLocation) {
                        console.log(`Migrating location "${location}" to "${validatedLocation}" for ${name}`);
                    }
                }
            }

            return { name, stallNumber, location: validatedLocation, group };
        }).filter(stall => stall !== null);
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, ''); // Basic sanitization
    }

    updateTitle() {
        const campusName = this.currentCampus.charAt(0).toUpperCase() + this.currentCampus.slice(1);
        const titleElement = document.querySelector('.page-title');
        if (titleElement) {
            titleElement.textContent = `Stallholder Editor - ${campusName}`;
        }
        const tableTitle = document.querySelector('.table-title');
        if (tableTitle) {
            tableTitle.textContent = `${campusName} Stallholders`;
        }
    }

    updateLocationFilter() {
        const filterSelect = document.getElementById('filterLocation');
        if (!filterSelect) return;
        
        const validLocations = LOCATION_CONFIG[this.currentCampus] || [];
        
        // Clear existing options except "All Locations"
        filterSelect.innerHTML = '<option value="">All Locations</option>';
        
        // Add campus-specific location options
        validLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            filterSelect.appendChild(option);
        });
    }

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('searchStalls');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Filter
        const filterSelect = document.getElementById('filterLocation');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.handleFilter(e.target.value);
            });
        }

        // Add stall
        const addBtn = document.getElementById('addStall');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addNewStall();
            });
        }

        // Export
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Add quick save shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.exportData();
            }
        });
    }

    handleSearch(query) {
        const searchTerm = this.sanitizeString(query).toLowerCase();
        const locationFilter = document.getElementById('filterLocation');
        const filterValue = locationFilter ? locationFilter.value : '';

        this.filteredStallholders = this.stallholders.filter(stall => {
            const matchesSearch = !searchTerm || 
                stall.name.toLowerCase().includes(searchTerm) ||
                stall.stallNumber.toString().includes(searchTerm) ||
                stall.location.toLowerCase().includes(searchTerm);
            
            const matchesLocation = !filterValue || stall.location === filterValue;
            
            return matchesSearch && matchesLocation;
        });

        this.render();
    }

    handleFilter(location) {
        const searchInput = document.getElementById('searchStalls');
        const searchTerm = searchInput ? this.sanitizeString(searchInput.value).toLowerCase() : '';

        this.filteredStallholders = this.stallholders.filter(stall => {
            const matchesSearch = !searchTerm || 
                stall.name.toLowerCase().includes(searchTerm) ||
                stall.stallNumber.toString().includes(searchTerm) ||
                stall.location.toLowerCase().includes(searchTerm);
            
            const matchesLocation = !location || stall.location === location;
            
            return matchesSearch && matchesLocation;
        });

        this.render();
    }

    addNewStall() {
        const validLocations = LOCATION_CONFIG[this.currentCampus] || [];
        const defaultLocation = validLocations[0] || 'Ruskin Courtyard';

        const newStall = {
            name: "New Stallholder",
            stallNumber: this.nextStallId++,
            location: defaultLocation,
            group: "Society"
        };

        this.stallholders.push(newStall);
        this.hasUnsavedChanges = true;
        this.updateSaveStatus();
        
        // Refresh the search/filter to include new stall
        const searchInput = document.getElementById('searchStalls');
        this.handleSearch(searchInput ? searchInput.value : '');
        
        this.showToast('New stallholder added - remember to export!', 'warning');
    }

    deleteStall(index) {
        if (confirm('Are you sure you want to delete this stallholder?')) {
            this.stallholders.splice(index, 1);
            this.hasUnsavedChanges = true;
            this.updateSaveStatus();
            
            // Refresh the search/filter after deletion
            const searchInput = document.getElementById('searchStalls');
            this.handleSearch(searchInput ? searchInput.value : '');
            
            this.showToast('Stallholder deleted - remember to export!', 'warning');
        }
    }

    updateStall(index, field, value) {
        if (field === 'stallNumber') {
            value = parseInt(value);
            // Check for duplicates
            if (this.stallholders.some((s, i) => i !== index && s.stallNumber === value)) {
                this.showToast('Stall number already exists!', 'error');
                return false;
            }
        }
        
        // Validate location against current campus
        if (field === 'location') {
            const validLocations = LOCATION_CONFIG[this.currentCampus] || [];
            if (!validLocations.includes(value)) {
                this.showToast(`Invalid location for ${this.currentCampus}!`, 'error');
                return false;
            }
        }
        
        // Sanitize the value
        if (typeof value === 'string') {
            value = this.sanitizeString(value);
        }
        
        this.stallholders[index][field] = value;
        this.hasUnsavedChanges = true;
        this.updateSaveStatus();
        this.showToast('Changes made locally - remember to export!', 'warning');
        return true;
    }

    updateSaveStatus() {
        // Add visual indicator for unsaved changes
        const header = document.querySelector('.page-title');
        if (header) {
            if (this.hasUnsavedChanges) {
                header.style.color = '#F36D21'; // Orange warning color
                header.textContent = header.textContent.replace(' *', '') + ' *';
            } else {
                header.style.color = '';
                header.textContent = header.textContent.replace(' *', '');
            }
        }
    }

    render() {
        const totalCount = document.getElementById('totalCount');
        if (totalCount) {
            totalCount.textContent = this.filteredStallholders.length;
        }

        // Render both table and cards
        this.renderTable();
        this.renderCards();
    }

    renderTable() {
        const tbody = document.getElementById('stallholdersTableBody');
        if (!tbody) return;

        // Clear previous content
        tbody.innerHTML = '';

        if (this.filteredStallholders.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.style.textAlign = 'center';
            td.style.color = '#757575';
            td.style.padding = '2rem';
            td.textContent = 'No stallholders found';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        this.filteredStallholders.forEach((stall, displayIndex) => {
            const actualIndex = this.stallholders.indexOf(stall);
            const tr = document.createElement('tr');
            
            // Stall Number Cell
            const stallNumCell = document.createElement('td');
            const stallNumDiv = document.createElement('div');
            stallNumDiv.className = 'editable-cell';
            stallNumDiv.contentEditable = true;
            stallNumDiv.dataset.field = 'stallNumber';
            stallNumDiv.dataset.index = actualIndex;
            stallNumDiv.style.background = 'var(--union-black)';
            stallNumDiv.style.color = 'var(--brilliant-green)';
            stallNumDiv.style.textAlign = 'center';
            stallNumDiv.style.borderRadius = '20px';
            stallNumDiv.style.padding = '0.25rem 0.75rem';
            stallNumDiv.style.minWidth = '60px';
            stallNumDiv.textContent = stall.stallNumber;
            stallNumCell.appendChild(stallNumDiv);
            
            // Name Cell
            const nameCell = document.createElement('td');
            const nameDiv = document.createElement('div');
            nameDiv.className = 'editable-cell';
            nameDiv.contentEditable = true;
            nameDiv.dataset.field = 'name';
            nameDiv.dataset.index = actualIndex;
            nameDiv.textContent = stall.name;
            nameCell.appendChild(nameDiv);
            
            // Location Cell
            const locationCell = document.createElement('td');
            const locationSelect = document.createElement('select');
            locationSelect.className = 'location-select';
            locationSelect.dataset.field = 'location';
            locationSelect.dataset.index = actualIndex;
            
            const validLocations = LOCATION_CONFIG[this.currentCampus] || [];
            validLocations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc;
                option.textContent = loc;
                option.selected = stall.location === loc;
                locationSelect.appendChild(option);
            });
            locationCell.appendChild(locationSelect);
            
            // Group Cell
            const groupCell = document.createElement('td');
            const groupSelect = document.createElement('select');
            groupSelect.className = 'group-select';
            groupSelect.dataset.field = 'group';
            groupSelect.dataset.index = actualIndex;
            
            const groups = ['Society', 'SU', 'Native', 'University'];
            groups.forEach(grp => {
                const option = document.createElement('option');
                option.value = grp;
                option.textContent = grp;
                option.selected = stall.group === grp;
                groupSelect.appendChild(option);
            });
            groupCell.appendChild(groupSelect);
            
            // Actions Cell
            const actionsCell = document.createElement('td');
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'row-actions';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-sm btn-danger';
            deleteBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            deleteBtn.addEventListener('click', () => this.deleteStall(actualIndex));
            
            actionsDiv.appendChild(deleteBtn);
            actionsCell.appendChild(actionsDiv);
            
            tr.appendChild(stallNumCell);
            tr.appendChild(nameCell);
            tr.appendChild(locationCell);
            tr.appendChild(groupCell);
            tr.appendChild(actionsCell);
            
            tbody.appendChild(tr);
        });

        this.setupTableListeners();
    }

    renderCards() {
        const container = document.getElementById('cardsContainer');
        if (!container) return;
        
        // Clear previous content
        container.innerHTML = '';

        if (this.filteredStallholders.length === 0) {
            const noResultsDiv = document.createElement('div');
            noResultsDiv.style.textAlign = 'center';
            noResultsDiv.style.color = '#757575';
            noResultsDiv.style.padding = '2rem';
            noResultsDiv.textContent = 'No stallholders found';
            container.appendChild(noResultsDiv);
            return;
        }

        this.filteredStallholders.forEach((stall, displayIndex) => {
            const actualIndex = this.stallholders.indexOf(stall);
            
            const cardDiv = document.createElement('div');
            cardDiv.className = 'stallholder-card';
            
            // Card Header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'card-header';
            
            const stallNumDiv = document.createElement('div');
            stallNumDiv.className = 'card-stall-number';
            stallNumDiv.textContent = stall.stallNumber;
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'card-name';
            nameDiv.textContent = stall.name;
            
            headerDiv.appendChild(stallNumDiv);
            headerDiv.appendChild(nameDiv);
            
            // Name Field
            const nameFieldDiv = document.createElement('div');
            nameFieldDiv.className = 'card-field';
            
            const nameLabel = document.createElement('label');
            nameLabel.textContent = 'Name';
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'card-input';
            nameInput.value = stall.name;
            nameInput.dataset.field = 'name';
            nameInput.dataset.index = actualIndex;
            
            nameFieldDiv.appendChild(nameLabel);
            nameFieldDiv.appendChild(nameInput);
            
            // Stall Number Field
            const numFieldDiv = document.createElement('div');
            numFieldDiv.className = 'card-field';
            
            const numLabel = document.createElement('label');
            numLabel.textContent = 'Stall Number';
            
            const numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.className = 'card-input';
            numInput.value = stall.stallNumber;
            numInput.dataset.field = 'stallNumber';
            numInput.dataset.index = actualIndex;
            
            numFieldDiv.appendChild(numLabel);
            numFieldDiv.appendChild(numInput);
            
            // Location Field
            const locFieldDiv = document.createElement('div');
            locFieldDiv.className = 'card-field';
            
            const locLabel = document.createElement('label');
            locLabel.textContent = 'Location';
            
            const locSelect = document.createElement('select');
            locSelect.className = 'card-select';
            locSelect.dataset.field = 'location';
            locSelect.dataset.index = actualIndex;
            
            const validLocations = LOCATION_CONFIG[this.currentCampus] || [];
            validLocations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc;
                option.textContent = loc;
                option.selected = stall.location === loc;
                locSelect.appendChild(option);
            });
            
            locFieldDiv.appendChild(locLabel);
            locFieldDiv.appendChild(locSelect);
            
            // Group Field
            const groupFieldDiv = document.createElement('div');
            groupFieldDiv.className = 'card-field';
            
            const groupLabel = document.createElement('label');
            groupLabel.textContent = 'Group';
            
            const groupSelect = document.createElement('select');
            groupSelect.className = 'card-select';
            groupSelect.dataset.field = 'group';
            groupSelect.dataset.index = actualIndex;
            
            const groups = ['Society', 'SU', 'Native', 'University'];
            groups.forEach(grp => {
                const option = document.createElement('option');
                option.value = grp;
                option.textContent = grp;
                option.selected = stall.group === grp;
                groupSelect.appendChild(option);
            });
            
            groupFieldDiv.appendChild(groupLabel);
            groupFieldDiv.appendChild(groupSelect);
            
            // Card Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'card-actions';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-sm btn-danger';
            deleteBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete
            `;
            deleteBtn.addEventListener('click', () => this.deleteStall(actualIndex));
            
            actionsDiv.appendChild(deleteBtn);
            
            cardDiv.appendChild(headerDiv);
            cardDiv.appendChild(nameFieldDiv);
            cardDiv.appendChild(numFieldDiv);
            cardDiv.appendChild(locFieldDiv);
            cardDiv.appendChild(groupFieldDiv);
            cardDiv.appendChild(actionsDiv);
            
            container.appendChild(cardDiv);
        });

        this.setupCardListeners();
    }

    setupTableListeners() {
        // Editable cells
        document.querySelectorAll('.editable-cell').forEach(cell => {
            cell.addEventListener('blur', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                const value = e.target.textContent.trim();
                
                if (this.updateStall(index, field, value)) {
                    // Success
                } else {
                    // Revert on failure
                    e.target.textContent = this.stallholders[index][field];
                }
            });

            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });

        // Select dropdowns
        document.querySelectorAll('.location-select, .group-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                const value = e.target.value;
                
                this.updateStall(index, field, value);
            });
        });
    }

    setupCardListeners() {
        // Card inputs
        document.querySelectorAll('.card-input').forEach(input => {
            input.addEventListener('blur', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                const value = field === 'stallNumber' ? parseInt(e.target.value) : e.target.value.trim();
                
                if (this.updateStall(index, field, value)) {
                    // Update card header if name or number changed
                    if (field === 'name' || field === 'stallNumber') {
                        this.render();
                    }
                } else {
                    // Revert on failure
                    e.target.value = this.stallholders[index][field];
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });

        // Card selects
        document.querySelectorAll('.card-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                const value = e.target.value;
                
                this.updateStall(index, field, value);
            });
        });
    }

    exportData() {
        const campusName = this.currentCampus.charAt(0).toUpperCase() + this.currentCampus.slice(1);
        const dataStr = JSON.stringify(this.stallholders, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentCampus}-stallholders-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);

        this.hasUnsavedChanges = false;
        this.updateSaveStatus();

        // Show detailed instructions
        this.showExportInstructions();
        
        // Show feedback with animation
        const btn = document.getElementById('exportData');
        if (btn) {
            btn.classList.add('success-animation');
            setTimeout(() => btn.classList.remove('success-animation'), 300);
        }
        
        this.showToast('Data exported successfully!', 'success');
    }

    showExportInstructions() {
        const modal = document.createElement('div');
        modal.className = 'export-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>File Exported Successfully!</h3>
                        <button class="modal-close" onclick="this.closest('.export-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <h4>Next Steps to Update Website:</h4>
                        <ol style="text-align: left; padding-left: 1.5rem; line-height: 1.8;">
                            <li><strong>Open the downloaded file</strong> and copy all content (Ctrl+A, Ctrl+C)</li>
                            <li><strong>Go to your GitHub repository</strong></li>
                            <li><strong>Navigate to:</strong> <code>data/${this.currentCampus}-stallholders.json</code></li>
                            <li><strong>Click the edit button</strong> (pencil icon)</li>
                            <li><strong>Select all existing content</strong> and replace with your copied data</li>
                            <li><strong>Commit the changes</strong> - your website will update automatically!</li>
                        </ol>
                        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                            <strong>💡 Tip:</strong> Always test your changes on a staging branch first if possible.
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 15000); // Auto-remove after 15 seconds
    }

    setupAutoSaveReminder() {
        // Remind user to save every 10 minutes if there are unsaved changes
        setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.showToast('Don\'t forget to export your changes!', 'warning');
            }
        }, 10 * 60 * 1000); // 10 minutes

        // Warn before page unload
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    showLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const tableContainer = document.getElementById('tableContainer');
        
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const tableContainer = document.getElementById('tableContainer');
        
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
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
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new StallholderEditor();
});
