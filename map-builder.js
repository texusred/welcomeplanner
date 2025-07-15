// Map Builder - ARU Students' Union
// Enhanced desktop map creation tool

class MapBuilder {
    constructor() {
        this.currentLocation = '';
        this.gridWidth = 12;
        this.gridHeight = 12;
        this.gridData = {};
        this.currentStallType = 'stall-standard';
        this.currentInterface = 'welcome'; // welcome, setup, editing, export
        this.nextStallId = 1;
        this.controlsMinimized = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showInterface('welcome');
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('backToMain').addEventListener('click', () => {
            window.location.href = 'admin-dashboard.html';
        });

        // Location selector
        document.getElementById('mapLocation').addEventListener('change', (e) => {
            this.handleLocationChange(e.target.value);
        });

        // Setup interface
        document.getElementById('loadExisting').addEventListener('click', () => {
            this.loadExistingMap();
        });

        document.getElementById('newMap').addEventListener('click', () => {
            this.startNewMap();
        });

        document.getElementById('createGrid').addEventListener('click', () => {
            this.createGridAndStartEditing();
        });

        // Editing interface
        document.getElementById('backToSetup').addEventListener('click', () => {
            this.backToSetup();
        });

        document.getElementById('resetGrid').addEventListener('click', () => {
            this.resetGrid();
        });

        document.getElementById('exportMap').addEventListener('click', () => {
            this.goToExport();
        });

        document.getElementById('minimizeControls').addEventListener('click', () => {
            this.toggleControlsMinimized();
        });

        // Export interface
        document.getElementById('generateCode').addEventListener('click', () => {
            this.generateCode();
        });

        document.getElementById('copyCode').addEventListener('click', () => {
            this.copyCode();
        });

        document.getElementById('backToEdit').addEventListener('click', () => {
            this.backToEditing();
        });

        // Color selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.color-option')) {
                this.selectColor(e.target.closest('.color-option'));
            }
        });

        // Grid dimension inputs
        document.getElementById('gridWidth').addEventListener('change', (e) => {
            this.gridWidth = parseInt(e.target.value);
        });

        document.getElementById('gridHeight').addEventListener('change', (e) => {
            this.gridHeight = parseInt(e.target.value);
        });

        // Keyboard shortcuts for editing
        document.addEventListener('keydown', (e) => {
            if (this.currentInterface === 'editing') {
                this.handleKeyboardShortcuts(e);
            }
        });
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
        document.getElementById('locationName').textContent = displayName;
        document.getElementById('mapFileName').textContent = `maps/${this.currentLocation}.html`;
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
        // Don't change interface - stay on setup to adjust dimensions
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
            document.getElementById('stallNumber').focus();
        }, 300);
    }

    renderGrid() {
        const canvas = document.getElementById('gridCanvas');
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
                    this.assignCell(x, y);
                });

                // Add hover preview
                cell.addEventListener('mouseenter', () => {
                    if (this.currentStallType !== 'clear') {
                        cell.classList.add('hover-preview', this.currentStallType);
                    }
                });

                cell.addEventListener('mouseleave', () => {
                    cell.classList.remove('hover-preview', 'stall-standard', 'stall-medical', 'stall-featured', 'building', 'infrastructure', 'empty');
                    // Re-apply actual data if exists
                    const cellData = this.gridData[`${x}-${y}`];
                    if (cellData) {
                        this.applyCellData(cell, cellData);
                    }
                });

                canvas.appendChild(cell);
            }
        }

        // Re-render existing data if any
        this.renderExistingData();
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
        this.updateStatus(`Selected: ${this.getTypeDisplayName()} - Click cells to apply`);
    }

    assignCell(x, y) {
        if (this.currentInterface !== 'editing') return;

        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        const stallNumber = document.getElementById('stallNumber').value;
        const stallLabel = document.getElementById('stallLabel').value;
        
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
        if (this.currentStallType.includes('stall') && stallNumber) {
            document.getElementById('stallNumber').value = parseInt(stallNumber) + 1;
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
        cell.className = 'cell';
        cell.textContent = '';
        delete this.gridData[`${x}-${y}`];
        
        // Brief selection feedback
        cell.classList.add('selected');
        setTimeout(() => cell.classList.remove('selected'), 200);
        
        this.updateStatus('Cell cleared');
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

        // Clear grid data
        this.gridData = {};

        // Reset inputs
        document.getElementById('stallNumber').value = '';
        document.getElementById('stallLabel').value = '';

        this.updateStatus('Grid cleared - click cells to assign colors and numbers');
        this.updateGridInfo();
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
        
        codeOutput.textContent = code;
        codeOutput.classList.add('visible');
        
        // Enable copy button
        document.getElementById('copyCode').disabled = false;
        
        this.updateStatus('Code generated successfully!');
    }

    createMapCode() {
        const locationNames = {
            'ruskin-courtyard': 'Ruskin Courtyard',
            'science-walkway': 'Science Walkway',
            'lab-courtyard': 'LAB Courtyard'
        };

        const displayName = locationNames[this.currentLocation] || this.currentLocation;
        
        // Generate merged cell styles
        const mergeStyles = this.generateMergedCellStyles();
        
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
        
        /* Merged cell styles */
        ${mergeStyles}
        
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

    generateMergedCellStyles() {
        let styles = '';
        const processedCells = new Set();
        
        // Check all cells for merging opportunities
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const cellKey = `${x}-${y}`;
                if (processedCells.has(cellKey)) continue;
                
                const cellData = this.gridData[cellKey];
                if (!cellData) continue;
                
                // Find mergeable groups
                const mergeGroup = this.findMergeGroup(x, y, cellData);
                if (mergeGroup.length > 1) {
                    styles += this.generateMergeCSS(mergeGroup, cellData);
                    mergeGroup.forEach(pos => processedCells.add(`${pos.x}-${pos.y}`));
                }
            }
        }
        
        return styles;
    }

    findMergeGroup(startX, startY, cellData) {
        const group = [];
        const visited = new Set();
        const queue = [{ x: startX, y: startY }];
        
        while (queue.length > 0) {
            const { x, y } = queue.shift();
            const key = `${x}-${y}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            const currentCell = this.gridData[key];
            if (!currentCell) continue;
            
            // Check if cells should merge
            if (this.shouldMerge(cellData, currentCell)) {
                group.push({ x, y });
                
                // Check adjacent cells
                const adjacent = [
                    { x: x - 1, y }, { x: x + 1, y },
                    { x, y: y - 1 }, { x, y: y + 1 }
                ];
                
                adjacent.forEach(pos => {
                    if (pos.x >= 0 && pos.x < this.gridWidth && 
                        pos.y >= 0 && pos.y < this.gridHeight &&
                        !visited.has(`${pos.x}-${pos.y}`)) {
                        queue.push(pos);
                    }
                });
            }
        }
        
        return group;
    }

    shouldMerge(cell1, cell2) {
        // Merge building blocks
        if (cell1.type === 'building' && cell2.type === 'building') {
            return true;
        }
        
        // Merge stalls with same number
        if (cell1.type.includes('stall') && cell2.type.includes('stall') && 
            cell1.number && cell2.number && cell1.number === cell2.number) {
            return true;
        }
        
        return false;
    }

    generateMergeCSS(group, cellData) {
        if (group.length <= 1) return '';
        
        const selector = group.map(pos => 
            `.cell[data-x="${pos.x}"][data-y="${pos.y}"]`
        ).join(', ');
        
        let styles = `
        ${selector} {
            border: none;
        }
        `;
        
        // Add border only on outer edges
        group.forEach(pos => {
            const { x, y } = pos;
            const cellSelector = `.cell[data-x="${x}"][data-y="${y}"]`;
            
            const hasLeft = group.some(p => p.x === x - 1 && p.y === y);
            const hasRight = group.some(p => p.x === x + 1 && p.y === y);
            const hasTop = group.some(p => p.x === x && p.y === y - 1);
            const hasBottom = group.some(p => p.x === x && p.y === y + 1);
            
            const borderColor = cellData.type === 'building' ? '#4a5568' : 
                              cellData.type === 'stall-standard' ? '#77bc1f' :
                              cellData.type === 'stall-medical' ? '#dc2626' :
                              cellData.type === 'stall-featured' ? '#10b981' : 'transparent';
            
            styles += `
        ${cellSelector} {
            ${!hasLeft ? `border-left: 2px solid ${borderColor};` : ''}
            ${!hasRight ? `border-right: 2px solid ${borderColor};` : ''}
            ${!hasTop ? `border-top: 2px solid ${borderColor};` : ''}
            ${!hasBottom ? `border-bottom: 2px solid ${borderColor};` : ''}
        }
            `;
        });
        
        // For stalls with numbers, hide number on all but center cell
        if (cellData.type.includes('stall') && cellData.number) {
            const centerCell = this.findCenterCell(group);
            group.forEach(pos => {
                if (pos.x !== centerCell.x || pos.y !== centerCell.y) {
                    styles += `
        .cell[data-x="${pos.x}"][data-y="${pos.y}"] {
            font-size: 0;
        }
                    `;
                }
            });
            
            // Make center cell number larger for merged stalls
            styles += `
        .cell[data-x="${centerCell.x}"][data-y="${centerCell.y}"] {
            font-size: 16px;
            font-weight: bold;
        }
            `;
        }
        
        return styles;
    }

    findCenterCell(group) {
        const minX = Math.min(...group.map(p => p.x));
        const maxX = Math.max(...group.map(p => p.x));
        const minY = Math.min(...group.map(p => p.y));
        const maxY = Math.max(...group.map(p => p.y));
        
        const centerX = Math.floor((minX + maxX) / 2);
        const centerY = Math.floor((minY + maxY) / 2);
        
        // Find the cell closest to the calculated center
        return group.reduce((closest, current) => {
            const closestDist = Math.abs(closest.x - centerX) + Math.abs(closest.y - centerY);
            const currentDist = Math.abs(current.x - centerX) + Math.abs(current.y - centerY);
            return currentDist < closestDist ? current : closest;
        }, group[0]);
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

        html = `            <div class="${classes.join(' ')}"${dataAttrs}>${content}</div>\n`;
        return html;
    }

    copyCode() {
        const codeOutput = document.getElementById('codeOutput');
        const code = codeOutput.textContent;
        
        if (!code) {
            alert('Generate code first!');
            return;
        }

        navigator.clipboard.writeText(code).then(() => {
            // Visual feedback
            const btn = document.getElementById('copyCode');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
            btn.style.background = '#22c55e';
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 2000);
            
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
            cellCountElement.textContent = `Cells: ${assignedCells} assigned`;
        }
    }

    resetMapData() {
        this.gridData = {};
        this.nextStallId = 1;
        
        // Reset form inputs
        document.getElementById('stallNumber').value = '';
        document.getElementById('stallLabel').value = '';
        
        // Clear grid if it exists
        const canvas = document.getElementById('gridCanvas');
        canvas.innerHTML = '';
        
        // Reset to default color selection
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        const defaultOption = document.querySelector('.color-option[data-type="stall-standard"]');
        if (defaultOption) {
            defaultOption.classList.add('selected');
        }
        this.currentStallType = 'stall-standard';
        
        // Clear export area
        const codeOutput = document.getElementById('codeOutput');
        codeOutput.textContent = '';
        codeOutput.classList.remove('visible');
        document.getElementById('copyCode').disabled = true;
    }

    showLoading() {
        document.getElementById('loadingIndicator').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}

// Initialize the map builder when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mapBuilder = new MapBuilder();
});
