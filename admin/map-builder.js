// Map Builder - ARU Students' Union
// Enhanced desktop map creation tool with group functionality

class MapBuilder {
    constructor() {
        this.currentLocation = '';
        this.gridWidth = 12;
        this.gridHeight = 12;
        this.gridData = {};
        this.currentStallType = 'stall-standard';
        this.currentInterface = 'welcome';
        this.nextStallId = 1;
        this.controlsMinimized = false;
        
        // Group functionality
        this.groupMode = false;
        this.currentGroup = [];
        this.groups = {}; // groupId -> {cells: [], data: {}}
        this.nextGroupId = 1;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showInterface('welcome');
    }

    setupEventListeners() {
        try {
            // Location selector
            const mapLocationElement = document.getElementById('mapLocation');
            if (mapLocationElement) {
                mapLocationElement.addEventListener('change', (e) => {
                    this.handleLocationChange(e.target.value);
                });
            }

            // Setup interface
            const loadExistingElement = document.getElementById('loadExisting');
            if (loadExistingElement) {
                loadExistingElement.addEventListener('click', () => {
                    this.loadExistingMap();
                });
            }

            const newMapElement = document.getElementById('newMap');
            if (newMapElement) {
                newMapElement.addEventListener('click', () => {
                    this.startNewMap();
                });
            }

            const createGridElement = document.getElementById('createGrid');
            if (createGridElement) {
                createGridElement.addEventListener('click', () => {
                    this.createGridAndStartEditing();
                });
            }

            // Editing interface
            const backToSetupElement = document.getElementById('backToSetup');
            if (backToSetupElement) {
                backToSetupElement.addEventListener('click', () => {
                    this.backToSetup();
                });
            }

            const resetGridElement = document.getElementById('resetGrid');
            if (resetGridElement) {
                resetGridElement.addEventListener('click', () => {
                    this.resetGrid();
                });
            }

            const exportMapElement = document.getElementById('exportMap');
            if (exportMapElement) {
                exportMapElement.addEventListener('click', () => {
                    this.goToExport();
                });
            }

            const minimizeControlsElement = document.getElementById('minimizeControls');
            if (minimizeControlsElement) {
                minimizeControlsElement.addEventListener('click', () => {
                    this.toggleControlsMinimized();
                });
            }

            // Group mode toggle
            const groupModeToggle = document.getElementById('groupModeToggle');
            if (groupModeToggle) {
                groupModeToggle.addEventListener('click', () => {
                    this.toggleGroupMode();
                });
            }

            // Finish group button
            const finishGroupBtn = document.getElementById('finishGroup');
            if (finishGroupBtn) {
                finishGroupBtn.addEventListener('click', () => {
                    this.finishCurrentGroup();
                });
            }

            // Cancel group button
            const cancelGroupBtn = document.getElementById('cancelGroup');
            if (cancelGroupBtn) {
                cancelGroupBtn.addEventListener('click', () => {
                    this.cancelCurrentGroup();
                });
            }

            // Export interface
            const generateCodeElement = document.getElementById('generateCode');
            if (generateCodeElement) {
                generateCodeElement.addEventListener('click', () => {
                    this.generateCode();
                });
            }

            const copyCodeElement = document.getElementById('copyCode');
            if (copyCodeElement) {
                copyCodeElement.addEventListener('click', () => {
                    this.copyCode();
                });
            }

            const backToEditElement = document.getElementById('backToEdit');
            if (backToEditElement) {
                backToEditElement.addEventListener('click', () => {
                    this.backToEditing();
                });
            }

            // Color selection
            document.addEventListener('click', (e) => {
                if (e.target.closest('.color-option')) {
                    this.selectColor(e.target.closest('.color-option'));
                }
            });

            // Grid dimension inputs
            const gridWidthElement = document.getElementById('gridWidth');
            if (gridWidthElement) {
                gridWidthElement.addEventListener('change', (e) => {
                    this.gridWidth = parseInt(e.target.value);
                });
            }

            const gridHeightElement = document.getElementById('gridHeight');
            if (gridHeightElement) {
                gridHeightElement.addEventListener('change', (e) => {
                    this.gridHeight = parseInt(e.target.value);
                });
            }

            // Keyboard shortcuts for editing
            document.addEventListener('keydown', (e) => {
                if (this.currentInterface === 'editing') {
                    this.handleKeyboardShortcuts(e);
                }
            });

        } catch (error) {
            console.error('Error in setupEventListeners:', error);
        }
    }

    // Group Mode Functions
    toggleGroupMode() {
        this.groupMode = !this.groupMode;
        
        const groupModeToggle = document.getElementById('groupModeToggle');
        const groupControls = document.getElementById('groupControls');
        const normalControls = document.getElementById('normalControls');
        
        if (this.groupMode) {
            // Enable group mode
            groupModeToggle.textContent = 'Exit Group Mode';
            groupModeToggle.classList.add('active');
            if (groupControls) groupControls.style.display = 'block';
            if (normalControls) normalControls.style.display = 'none';
            
            this.updateStatus('Group Mode: Click cells to add to group, then click "Finish Group"');
        } else {
            // Disable group mode
            groupModeToggle.textContent = 'Group Mode';
            groupModeToggle.classList.remove('active');
            if (groupControls) groupControls.style.display = 'none';
            if (normalControls) normalControls.style.display = 'block';
            
            this.cancelCurrentGroup();
            this.updateStatus('Normal Mode: Click cells to assign colors and stall numbers');
        }
    }

    finishCurrentGroup() {
        if (this.currentGroup.length === 0) {
            this.showToast('No cells selected for group', 'warning');
            return;
        }

        // Use the group-specific input field
        const groupNumberElement = document.getElementById('groupNumber');
        const groupValue = groupNumberElement ? groupNumberElement.value.trim() : '';

        if (!groupValue) {
            this.showToast('Please enter a number or label for the group', 'warning');
            return;
        }

        // Create group data
        const groupId = this.nextGroupId++;
        const groupData = {
            type: this.currentStallType,
            number: groupValue,
            label: groupValue,
            id: groupId
        };

        // Store group
        this.groups[groupId] = {
            cells: [...this.currentGroup],
            data: groupData
        };

        // Apply to all cells in group
        this.currentGroup.forEach(cellKey => {
            const [x, y] = cellKey.split('-').map(Number);
            const cellData = {
                ...groupData,
                x: x,
                y: y,
                groupId: groupId
            };
            
            this.gridData[cellKey] = cellData;
            
            // Update visual
            const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                this.applyCellData(cell, cellData);
                cell.classList.remove('group-selected');
            }
        });

        // Auto-increment for next group if it's a number
        if (this.currentStallType.includes('stall') && !isNaN(groupValue) && groupNumberElement) {
            groupNumberElement.value = parseInt(groupValue) + 1;
        }

        this.showToast(`Group created with ${this.currentGroup.length} cells`, 'success');
        this.currentGroup = [];
        this.updateGroupStatus();
        this.updateGridInfo();
    }

    cancelCurrentGroup() {
        // Remove visual selection from current group
        this.currentGroup.forEach(cellKey => {
            const [x, y] = cellKey.split('-').map(Number);
            const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                cell.classList.remove('group-selected');
            }
        });
        
        this.currentGroup = [];
        this.updateGroupStatus();
    }

    updateGroupStatus() {
        const groupStatus = document.getElementById('groupStatus');
        if (groupStatus) {
            if (this.currentGroup.length === 0) {
                groupStatus.textContent = 'No cells selected';
            } else {
                groupStatus.textContent = `${this.currentGroup.length} cells selected`;
            }
        }
    }

    handleLocationChange(location) {
        if (!location) {
            this.showInterface('welcome');
            return;
        }

        this.currentLocation = location;
        this.updateLocationDisplay();
        this.showInterface('setup');
    }

    updateLocationDisplay() {
        const locationNames = {
            'ruskin-courtyard': 'Ruskin Courtyard',
            'science-walkway': 'Science Walkway',
            'lab-courtyard': 'LAB Courtyard'
        };

        const displayName = locationNames[this.currentLocation] || this.currentLocation;
        
        const locationNameElement = document.getElementById('locationName');
        const mapFileNameElement = document.getElementById('mapFileName');
        
        if (locationNameElement) {
            locationNameElement.textContent = displayName;
        }
        
        if (mapFileNameElement) {
            mapFileNameElement.textContent = `maps/${this.currentLocation}.html`;
        }
    }

    showInterface(interfaceName) {
        // Hide all interfaces
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('gridSetupInterface').style.display = 'none';
        document.getElementById('editingInterface').style.display = 'none';
        document.getElementById('exportInterface').style.display = 'none';

        // Show selected interface
        switch (interfaceName) {
            case 'welcome':
                document.getElementById('welcomeScreen').style.display = 'flex';
                break;
            case 'setup':
                document.getElementById('gridSetupInterface').style.display = 'block';
                break;
            case 'editing':
                document.getElementById('editingInterface').style.display = 'block';
                break;
            case 'export':
                document.getElementById('exportInterface').style.display = 'block';
                break;
        }

        this.currentInterface = interfaceName;
    }

    loadExistingMap() {
        alert(`Loading existing ${this.currentLocation} map would load the saved JSON data. For this demo, click "Create New" to start building.`);
    }

    startNewMap() {
        this.resetMapData();
        this.updateStatus('Set grid dimensions and click "Create Grid & Start Editing"');
    }

    createGridAndStartEditing() {
        this.gridWidth = parseInt(document.getElementById('gridWidth').value);
        this.gridHeight = parseInt(document.getElementById('gridHeight').value);

        // Validate dimensions
        if (this.gridWidth < 6 || this.gridWidth > 50 || this.gridHeight < 6 || this.gridHeight > 50) {
            alert('Grid dimensions must be between 6 and 50');
            return;
        }

        // Transition to full-screen editing
        this.showInterface('editing');
        this.renderGrid();
        this.updateGridInfo();
        this.updateStatus('Click cells to assign colors and stall numbers');
        
        // Auto-focus first input for quick editing
        setTimeout(() => {
            const stallNumberElement = document.getElementById('stallNumber');
            if (stallNumberElement) {
                stallNumberElement.focus();
            }
        }, 300);
    }

    renderGrid() {
        const canvas = document.getElementById('gridCanvas');
        if (!canvas) return;
        
        canvas.style.gridTemplateColumns = `repeat(${this.gridWidth}, 1fr)`;
        canvas.style.gridTemplateRows = `repeat(${this.gridHeight}, 1fr)`;

        // Clear existing grid
        canvas.innerHTML = '';
        
        // Create cells
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                cell.addEventListener('click', () => {
                    if (this.groupMode) {
                        this.toggleCellInGroup(x, y);
                    } else {
                        this.assignCell(x, y);
                    }
                });

                // Add hover preview for normal mode
                cell.addEventListener('mouseenter', () => {
                    if (!this.groupMode && this.currentStallType !== 'clear') {
                        cell.classList.add('hover-preview', this.currentStallType);
                    }
                });

                cell.addEventListener('mouseleave', () => {
                    if (!this.groupMode) {
                        cell.classList.remove('hover-preview', 'stall-standard', 'stall-medical', 'stall-featured', 'building', 'infrastructure', 'empty');
                        // Re-apply actual data if exists
                        const cellData = this.gridData[`${x}-${y}`];
                        if (cellData) {
                            this.applyCellData(cell, cellData);
                        }
                    }
                });

                canvas.appendChild(cell);
            }
        }

        // Re-render existing data if any
        this.renderExistingData();
    }

    toggleCellInGroup(x, y) {
        const cellKey = `${x}-${y}`;
        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        
        if (this.currentGroup.includes(cellKey)) {
            // Remove from group
            this.currentGroup = this.currentGroup.filter(key => key !== cellKey);
            cell.classList.remove('group-selected');
        } else {
            // Add to group
            this.currentGroup.push(cellKey);
            cell.classList.add('group-selected');
        }
        
        this.updateGroupStatus();
        this.updateStatus(`Group selection: ${this.currentGroup.length} cells selected`);
    }

    renderExistingData() {
        Object.values(this.gridData).forEach(cellData => {
            const cell = document.querySelector(`[data-x="${cellData.x}"][data-y="${cellData.y}"]`);
            if (cell) {
                this.applyCellData(cell, cellData);
            }
        });
    }

    selectColor(option) {
        // Remove selected class from all options
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Add selected class to clicked option
        option.classList.add('selected');
        this.currentStallType = option.dataset.type;
        
        // Update status
        if (this.groupMode) {
            this.updateStatus(`Group Mode - Selected: ${this.getTypeDisplayName()} - Click cells to add to group`);
        } else {
            this.updateStatus(`Selected: ${this.getTypeDisplayName()} - Click cells to apply`);
        }
    }

    assignCell(x, y) {
        if (this.currentInterface !== 'editing' || this.groupMode) return;

        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        const stallNumberElement = document.getElementById('stallNumber');
        const stallLabelElement = document.getElementById('stallLabel');
        
        const stallNumber = stallNumberElement ? stallNumberElement.value : '';
        const stallLabel = stallLabelElement ? stallLabelElement.value : '';
        
        // Handle clearing cell
        if (this.currentStallType === 'clear') {
            this.clearCell(cell, x, y);
            return;
        }

        // Create cell data
        const cellData = {
            type: this.currentStallType,
            number: stallNumber || '',
            label: stallLabel || '',
            x: x,
            y: y,
            id: this.nextStallId++
        };

        // Apply visual changes
        this.applyCellData(cell, cellData);

        // Store in grid data
        this.gridData[`${x}-${y}`] = cellData;

        // Auto-increment stall number for next assignment
        if (this.currentStallType.includes('stall') && stallNumber && stallNumberElement) {
            stallNumberElement.value = parseInt(stallNumber) + 1;
        }

        // Brief selection feedback
        cell.classList.add('selected');
        setTimeout(() => cell.classList.remove('selected'), 200);

        this.updateStatus(`Cell assigned: ${this.getTypeDisplayName()} ${stallNumber || stallLabel || ''}`);
        this.updateGridInfo();
    }

    applyCellData(cell, cellData) {
        // Remove previous classes
        cell.className = 'cell';
        
        // Add new class
        cell.classList.add(cellData.type);
        
        // Set content
        if (cellData.type.includes('stall') && cellData.number) {
            cell.textContent = cellData.number;
        } else if (cellData.label) {
            cell.textContent = cellData.label;
        } else if (cellData.type === 'infrastructure') {
            cell.textContent = 'INF';
        } else {
            cell.textContent = '';
        }
    }

    clearCell(cell, x, y) {
        const cellKey = `${x}-${y}`;
        
        // If cell is part of a group, remove the entire group
        const cellData = this.gridData[cellKey];
        if (cellData && cellData.groupId) {
            this.clearGroup(cellData.groupId);
            return;
        }
        
        // Clear individual cell
        cell.className = 'cell';
        cell.textContent = '';
        delete this.gridData[cellKey];
        
        // Brief selection feedback
        cell.classList.add('selected');
        setTimeout(() => cell.classList.remove('selected'), 200);
        
        this.updateStatus('Cell cleared');
        this.updateGridInfo();
    }

    clearGroup(groupId) {
        const group = this.groups[groupId];
        if (!group) return;
        
        // Clear all cells in the group
        group.cells.forEach(cellKey => {
            const [x, y] = cellKey.split('-').map(Number);
            const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                cell.className = 'cell';
                cell.textContent = '';
            }
            delete this.gridData[cellKey];
        });
        
        // Remove group
        delete this.groups[groupId];
        
        this.updateStatus(`Group cleared (${group.cells.length} cells)`);
        this.updateGridInfo();
    }

    getTypeDisplayName() {
        const typeNames = {
            'stall-standard': 'Standard Stall',
            'stall-medical': 'Medical Stall',
            'stall-featured': 'Featured Stall',
            'building': 'Building',
            'infrastructure': 'Infrastructure',
            'empty': 'Empty Space'
        };
        return typeNames[this.currentStallType] || this.currentStallType;
    }

    backToSetup() {
        if (Object.keys(this.gridData).length > 0) {
            if (!confirm('Going back will preserve your current progress. Continue?')) {
                return;
            }
        }
        this.showInterface('setup');
    }

    resetGrid() {
        if (!confirm('Are you sure you want to reset the entire grid? All progress will be lost.')) {
            return;
        }

        // Clear all cells
        document.querySelectorAll('.cell').forEach(cell => {
            cell.className = 'cell';
            cell.textContent = '';
        });

        // Clear grid data and groups
        this.gridData = {};
        this.groups = {};
        this.currentGroup = [];

        // Reset inputs
        const stallNumberElement = document.getElementById('stallNumber');
        const stallLabelElement = document.getElementById('stallLabel');
        
        if (stallNumberElement) stallNumberElement.value = '';
        if (stallLabelElement) stallLabelElement.value = '';

        this.updateStatus('Grid cleared - click cells to assign colors and numbers');
        this.updateGridInfo();
        this.updateGroupStatus();
    }

    goToExport() {
        if (Object.keys(this.gridData).length === 0) {
            alert('Please add at least one stall or element before exporting.');
            return;
        }

        this.showInterface('export');
        this.updateStatus('Ready to export - click "Generate Code" to create HTML/CSS');
    }

    backToEditing() {
        this.showInterface('editing');
        this.updateStatus('Click cells to assign colors and stall numbers');
    }

    toggleControlsMinimized() {
        this.controlsMinimized = !this.controlsMinimized;
        const controls = document.querySelector('.floating-controls');
        const content = document.getElementById('controlsContent');
        const minimizeBtn = document.getElementById('minimizeControls');
        
        if (!controls || !content || !minimizeBtn) return;
        
        if (this.controlsMinimized) {
            content.style.display = 'none';
            controls.classList.add('minimized');
            minimizeBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
            `;
            minimizeBtn.title = 'Expand controls';
        } else {
            content.style.display = 'block';
            controls.classList.remove('minimized');
            minimizeBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 14 10 14 10 20"></polyline>
                    <polyline points="20 10 14 10 14 4"></polyline>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
            `;
            minimizeBtn.title = 'Minimize controls';
        }
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    // Could implement undo functionality
                    break;
                case 's':
                    e.preventDefault();
                    this.goToExport();
                    break;
                case 'r':
                    e.preventDefault();
                    this.resetGrid();
                    break;
                case 'g':
                    e.preventDefault();
                    this.toggleGroupMode();
                    break;
            }
        }

        // Quick color selection
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            switch (e.key) {
                case '1':
                    this.selectColorByType('stall-standard');
                    break;
                case '2':
                    this.selectColorByType('stall-medical');
                    break;
                case '3':
                    this.selectColorByType('stall-featured');
                    break;
                case 'b':
                    this.selectColorByType('building');
                    break;
                case 'i':
                    this.selectColorByType('infrastructure');
                    break;
                case 'e':
                    this.selectColorByType('empty');
                    break;
                case 'Delete':
                case 'Backspace':
                    this.selectColorByType('clear');
                    break;
                case 'Escape':
                    if (this.groupMode) {
                        this.cancelCurrentGroup();
                    }
                    break;
                case 'Enter':
                    if (this.groupMode && this.currentGroup.length > 0) {
                        this.finishCurrentGroup();
                    }
                    break;
            }
        }
    }

    selectColorByType(type) {
        const option = document.querySelector(`[data-type="${type}"]`);
        if (option) {
            this.selectColor(option);
        }
    }

    generateCode() {
        if (Object.keys(this.gridData).length === 0) {
            alert('No data to export. Please add some stalls first.');
            return;
        }

        const code = this.createMapCode();
        const codeOutput = document.getElementById('codeOutput');
        
        if (!codeOutput) return;
        
        codeOutput.textContent = code;
        codeOutput.classList.add('visible');
        
        // Enable copy button
        const copyCodeBtn = document.getElementById('copyCode');
        if (copyCodeBtn) {
            copyCodeBtn.disabled = false;
        }
        
        this.updateStatus('Code generated successfully!');
    }

    createMapCode() {
        const locationNames = {
            'ruskin-courtyard': 'Ruskin Courtyard',
            'science-walkway': 'Science Walkway',
            'lab-courtyard': 'LAB Courtyard'
        };

        const displayName = locationNames[this.currentLocation] || this.currentLocation;
        
        // Generate CSS for grouped cells
        const groupStyles = this.generateGroupStyles();
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${displayName} Map | ARU Students' Union</title>
    <meta name="description" content="Interactive map for ${displayName} at the ARU Students' Union Welcome Fair">
    <meta name="theme-color" content="#00a5b4">
    <link rel="manifest" href="../manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Union Fair">
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f5f5f5;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        
        .title {
            text-align: center;
            color: #00a5b4;
            margin-bottom: 20px;
            font-size: 1.5rem;
            font-weight: bold;
        }
        
        .courtyard-grid {
            display: grid;
            grid-template-columns: repeat(${this.gridWidth}, 1fr);
            grid-template-rows: repeat(${this.gridHeight}, 50px);
            gap: 2px;
            background: #e5e5e5;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .cell {
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            border: 1px solid transparent;
        }
        
        .building {
            background: #4a5568;
            color: white;
            cursor: default;
            border: 1px solid #4a5568;
        }
        
        .empty {
            background: transparent;
            cursor: default;
            border: none;
        }
        
        .infrastructure {
            background: #ffd700;
            color: #333;
            font-size: 8px;
            cursor: default;
        }
        
        .stall-standard {
            background: #77bc1f;
            color: white;
            border: 1px solid #77bc1f;
        }
        
        .stall-medical {
            background: #dc2626;
            color: white;
            border: 1px solid #dc2626;
        }
        
        .stall-featured {
            background: #10b981;
            color: white;
            border: 1px solid #10b981;
        }
        
        .stall:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0, 165, 180, 0.4);
            z-index: 10;
        }
        
        /* Group styles */
        ${groupStyles}
        
        /* Highlight stall from URL parameter */
        .stall.highlighted {
            border: 3px solid #ffd700;
            box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.3);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.3); }
            50% { box-shadow: 0 0 0 6px rgba(255, 215, 0, 0.1); }
            100% { box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.3); }
        }
        
        .info-panel {
            background: #f8f9fa;
            border: 2px solid #00a5b4;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            display: none;
        }
        
        .info-panel h3 {
            color: #00a5b4;
            margin: 0 0 10px 0;
        }
        
        .info-panel p {
            margin: 5px 0;
            font-size: 14px;
        }
        
        .back-button {
            background: #00a5b4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 20px;
            transition: all 0.3s ease;
        }
        
        .back-button:hover {
            background: #008a96;
            transform: translateY(-2px);
        }
        
        @media (max-width: 768px) {
    .courtyard-grid {
        grid-template-columns: repeat(${this.gridWidth}, 1fr);
        grid-template-rows: repeat(${this.gridHeight}, 40px);
    }
}
    </style>
</head>
<body>
    <div class="container">
        <button class="back-button" onclick="window.location.href='../index.html'">← Back to Stall Finder</button>
        <h1 class="title">${displayName}</h1>
        
        <div class="courtyard-grid">`;

        // Generate grid cells
        for (let y = 0; y < this.gridHeight; y++) {
            html += '\n            <!-- Row ' + (y + 1) + ' -->\n';
            for (let x = 0; x < this.gridWidth; x++) {
                const cellData = this.gridData[`${x}-${y}`];
                if (cellData) {
                    html += this.generateCellHTML(cellData);
                } else {
                    html += '            <div class="cell empty"></div>\n';
                }
            }
        }

        html += `
        </div>
        
        <!-- Info Panel -->
        <div id="infoPanel" class="info-panel">
            <h3 id="stallName">Click a stall for details</h3>
            <p><strong>Stall Number:</strong> <span id="stallNumber">-</span></p>
            <p><strong>Location:</strong> ${displayName}</p>
            <p><strong>Group:</strong> Society</p>
        </div>
    </div>
    
<script>
        // Dynamic stall data loading
        let stallData = {};
        
        async function loadStallData() {
            try {
                const response = await fetch('../data/stallholders.json');
                const allStalls = await response.json();
                
                // Filter for this location only
                const locationStalls = allStalls.filter(stall => 
                    stall.location === "${displayName}"
                );
                
                // Convert to lookup object
                locationStalls.forEach(stall => {
                    stallData[stall.stallNumber] = {
                        name: stall.name,
                        group: stall.group
                    };
                });
                
                console.log('Stall data loaded:', Object.keys(stallData).length, 'stalls');
                
                // Set up click handlers AFTER data is loaded
                setupClickHandlers();
                
            } catch (error) {
                console.error('Failed to load stall data:', error);
            }
        }
        
        function setupClickHandlers() {
            // Add click handlers to stalls
            document.querySelectorAll('.stall-standard, .stall-medical, .stall-featured').forEach(stall => {
                stall.addEventListener('click', function() {
                    const stallNum = this.dataset.stall;
                    console.log('Clicked stall:', stallNum, 'Data available:', !!stallData[stallNum]);
                    if (stallData[stallNum]) {
                        document.getElementById('stallName').textContent = stallData[stallNum].name || 'Stall ' + stallNum;
                        document.getElementById('stallNumber').textContent = stallNum;
                        document.getElementById('infoPanel').style.display = 'block';
                    }
                });
            });
        }
        
        // Load data when page loads
        loadStallData();
        
        // Highlight stall from URL parameter (runs immediately - doesn't need data)
        console.log('Starting highlight check...');
        const urlParams = new URLSearchParams(window.location.search);
        const highlightStall = urlParams.get('highlight');
        console.log('URL highlight parameter:', highlightStall);
        console.log('Current URL:', window.location.href);
        
        if (highlightStall) {
            console.log('Looking for stall element with data-stall="' + highlightStall + '"');
            const stallElement = document.querySelector('[data-stall="' + highlightStall + '"]');
            console.log('Found stall element:', stallElement);
            
            if (stallElement) {
                console.log('Adding highlighted class...');
                stallElement.classList.add('highlighted');
                stallElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log('Highlighting applied successfully');
            } else {
                console.log('Stall element not found! Available stalls on page:');
                const allStalls = document.querySelectorAll('[data-stall]');
                allStalls.forEach(stall => {
                    console.log('  - Stall:', stall.dataset.stall);
                });
            }
        } else {
            console.log('No highlight parameter found in URL');
        }
    </script>
</body>
</html>`;

        return html;
    }

    generateGroupStyles() {
        let styles = '';
        
        // Generate styles for each group
        Object.values(this.groups).forEach(group => {
            if (group.cells.length <= 1) return;
            
            const groupClass = `group-${group.data.id}`;
            
            // Create selector for all cells in the group
            const cellSelectors = group.cells.map(cellKey => {
                const [x, y] = cellKey.split('-');
                return `[data-x="${x}"][data-y="${y}"]`;
            }).join(', ');
            
            // Remove borders between group cells
            styles += `
        ${cellSelectors} {
            border: none !important;
        }
        `;
            
            // Add outer border for the group
            group.cells.forEach(cellKey => {
                const [x, y] = cellKey.split('-').map(Number);
                const cellSelector = `[data-x="${x}"][data-y="${y}"]`;
                
                // Check which sides need borders (edges of the group)
                const hasLeft = group.cells.includes(`${x-1}-${y}`);
                const hasRight = group.cells.includes(`${x+1}-${y}`);
                const hasTop = group.cells.includes(`${x}-${y-1}`);
                const hasBottom = group.cells.includes(`${x}-${y+1}`);
                
                const borderColor = this.getBorderColorForType(group.data.type);
                
                let borderStyles = [];
                if (!hasLeft) borderStyles.push(`border-left: 2px solid ${borderColor}`);
                if (!hasRight) borderStyles.push(`border-right: 2px solid ${borderColor}`);
                if (!hasTop) borderStyles.push(`border-top: 2px solid ${borderColor}`);
                if (!hasBottom) borderStyles.push(`border-bottom: 2px solid ${borderColor}`);
                
                if (borderStyles.length > 0) {
                    styles += `
        ${cellSelector} {
            ${borderStyles.join(' !important; ')} !important;
        }
                    `;
                }
            });
            
            // For groups with numbers, only show number in center cell
            if (group.data.number) {
                const centerCell = this.findGroupCenter(group.cells);
                
                // Hide text in non-center cells
                group.cells.forEach(cellKey => {
                    if (cellKey !== centerCell) {
                        const [x, y] = cellKey.split('-');
                        styles += `
        [data-x="${x}"][data-y="${y}"] {
            font-size: 0 !important;
        }
                        `;
                    }
                });
                
                // Make center cell number larger
                const [centerX, centerY] = centerCell.split('-');
                styles += `
        [data-x="${centerX}"][data-y="${centerY}"] {
            font-size: 16px !important;
            font-weight: bold !important;
        }
                `;
            }
        });
        
        return styles;
    }

    getBorderColorForType(type) {
        const colorMap = {
            'stall-standard': '#77bc1f',
            'stall-medical': '#dc2626',
            'stall-featured': '#10b981',
            'building': '#4a5568',
            'infrastructure': '#ffd700',
            'empty': 'transparent'
        };
        return colorMap[type] || 'transparent';
    }

    findGroupCenter(cells) {
        // Find geometric center of the group
        const coords = cells.map(cellKey => {
            const [x, y] = cellKey.split('-').map(Number);
            return { x, y, key: cellKey };
        });
        
        const minX = Math.min(...coords.map(c => c.x));
        const maxX = Math.max(...coords.map(c => c.x));
        const minY = Math.min(...coords.map(c => c.y));
        const maxY = Math.max(...coords.map(c => c.y));
        
        const centerX = Math.floor((minX + maxX) / 2);
        const centerY = Math.floor((minY + maxY) / 2);
        
        // Find the cell closest to the calculated center
        let closestCell = coords[0];
        let minDistance = Infinity;
        
        coords.forEach(coord => {
            const distance = Math.abs(coord.x - centerX) + Math.abs(coord.y - centerY);
            if (distance < minDistance) {
                minDistance = distance;
                closestCell = coord;
            }
        });
        
        return closestCell.key;
    }

    generateCellHTML(cellData) {
        let html = '';
        let classes = ['cell'];
        let content = '';
        let dataAttrs = '';

        // Add type class
        classes.push(cellData.type);

        // Add stall class for interactive elements
        if (cellData.type.includes('stall')) {
            classes.push('stall');
            dataAttrs = ` data-stall="${cellData.number}"`;
            content = cellData.number;
        } else if (cellData.label) {
            content = cellData.label;
        } else if (cellData.type === 'infrastructure') {
            content = 'INF';
        }

        // Add group class if part of a group
        if (cellData.groupId) {
            classes.push(`group-${cellData.groupId}`);
        }

        html = `            <div class="${classes.join(' ')}" data-x="${cellData.x}" data-y="${cellData.y}"${dataAttrs}>${content}</div>\n`;
        return html;
    }

    copyCode() {
        const codeOutput = document.getElementById('codeOutput');
        if (!codeOutput) return;
        
        const code = codeOutput.textContent;
        
        if (!code) {
            alert('Generate code first!');
            return;
        }

        navigator.clipboard.writeText(code).then(() => {
            // Visual feedback
            const btn = document.getElementById('copyCode');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
                btn.style.background = '#22c55e';
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                }, 2000);
            }
            
            this.updateStatus('Code copied to clipboard! Create the HTML file and paste it in.');
        }).catch(() => {
            alert('Failed to copy to clipboard. Please select and copy the code manually.');
        });
    }

    updateStatus(message) {
        const statusElement = document.getElementById('canvasStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    updateGridInfo() {
        const dimensionsElement = document.getElementById('gridDimensions');
        const cellCountElement = document.getElementById('cellCount');
        
        if (dimensionsElement) {
            dimensionsElement.textContent = `Grid: ${this.gridWidth}×${this.gridHeight}`;
        }
        
        if (cellCountElement) {
            const assignedCells = Object.keys(this.gridData).length;
            const groupCount = Object.keys(this.groups).length;
            cellCountElement.textContent = `Cells: ${assignedCells} assigned, ${groupCount} groups`;
        }
    }

    resetMapData() {
        this.gridData = {};
        this.groups = {};
        this.currentGroup = [];
        this.nextStallId = 1;
        this.nextGroupId = 1;
        
        // Reset form inputs
        const stallNumberElement = document.getElementById('stallNumber');
        const stallLabelElement = document.getElementById('stallLabel');
        
        if (stallNumberElement) stallNumberElement.value = '';
        if (stallLabelElement) stallLabelElement.value = '';
        
        // Clear grid if it exists
        const canvas = document.getElementById('gridCanvas');
        if (canvas) {
            canvas.innerHTML = '';
        }
        
        // Reset to default color selection
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        const defaultOption = document.querySelector('.color-option[data-type="stall-standard"]');
        if (defaultOption) {
            defaultOption.classList.add('selected');
        }
        this.currentStallType = 'stall-standard';
        
        // Reset group mode
        if (this.groupMode) {
            this.toggleGroupMode();
        }
        
        // Clear export area
        const codeOutput = document.getElementById('codeOutput');
        if (codeOutput) {
            codeOutput.textContent = '';
            codeOutput.classList.remove('visible');
        }
        
        const copyCodeBtn = document.getElementById('copyCode');
        if (copyCodeBtn) {
            copyCodeBtn.disabled = true;
        }
    }

    showLoading() {
        const loadingElement = document.getElementById('loadingIndicator');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingElement = document.getElementById('loadingIndicator');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
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

// Initialize the map builder when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mapBuilder = new MapBuilder();
});