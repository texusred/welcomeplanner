// Cambridge Stall Planner - Drag and Drop Handler with Zoom/Pan

// Global state variables
let editMode = false;
let draggedElement = null;
let resizingElement = null;
let startPos = { x: 0, y: 0 };
let elementPos = { x: 0, y: 0 };
let startSize = { width: 0, height: 0 };
let selectedStalls = new Set();
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let groupDragging = false;
let groupStartPositions = new Map();

// Zoom and pan state
let currentZoom = 1;
let currentPan = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
let isZooming = false;
let lastTouchDistance = 0;
let isMobile = window.innerWidth <= 768;

// Zoom limits
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

/**
 * Initialize zoom and pan functionality
 */
function initializeZoomPan() {
    const wrapper = document.querySelector('.layout-wrapper');
    const container = document.getElementById('layoutContainer');
    
    if (!wrapper || !container) return;
    
    // Create zoom-pan container if it doesn't exist
    let zoomPanContainer = wrapper.querySelector('.zoom-pan-container');
    if (!zoomPanContainer) {
        zoomPanContainer = document.createElement('div');
        zoomPanContainer.className = 'zoom-pan-container';
        wrapper.appendChild(zoomPanContainer);
        zoomPanContainer.appendChild(container);
    }
    
    if (isMobile) {
        // Mobile: touch gestures
        wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
        wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
        wrapper.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        // Set initial fit-to-screen zoom
        setTimeout(fitToScreen, 100);
    } else {
        // Desktop: mouse wheel zoom
        wrapper.addEventListener('wheel', handleWheelZoom, { passive: false });
    }
    
    // Window resize handler
    window.addEventListener('resize', handleResize);
}

/**
 * Fit layout to screen (mobile default)
 */
function fitToScreen() {
    if (!isMobile) return;
    
    const wrapper = document.querySelector('.layout-wrapper');
    const container = document.getElementById('layoutContainer');
    
    if (!wrapper || !container) return;
    
    const wrapperRect = wrapper.getBoundingClientRect();
    const containerWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--container-width'));
    const containerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--container-height'));
    
    // Calculate scale to fit with padding
    const scaleX = (wrapperRect.width - 60) / containerWidth;
    const scaleY = (wrapperRect.height - 60) / containerHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1
    
    currentZoom = scale;
    currentPan = { x: 0, y: 0 };
    updateZoomPan();
}

/**
 * Update zoom and pan transform
 */
function updateZoomPan() {
    const zoomPanContainer = document.querySelector('.zoom-pan-container');
    if (!zoomPanContainer) return;
    
    zoomPanContainer.style.transform = `translate(${currentPan.x}px, ${currentPan.y}px) scale(${currentZoom})`;
}

/**
 * Handle wheel zoom (desktop)
 */
function handleWheelZoom(e) {
    if (editMode) return; // Don't zoom during edit mode
    
    e.preventDefault();
    
    const wrapper = document.querySelector('.layout-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
    
    // Calculate zoom delta
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * delta));
    
    if (newZoom !== currentZoom) {
        // Zoom towards mouse position
        const zoomRatio = newZoom / currentZoom;
        currentPan.x = centerX - (centerX - currentPan.x) * zoomRatio;
        currentPan.y = centerY - (centerY - currentPan.y) * zoomRatio;
        currentZoom = newZoom;
        
        updateZoomPan();
    }
}

/**
 * Handle touch start for mobile gestures
 */
function handleTouchStartGesture(e) {
    if (editMode) return;
    
    const touches = e.touches;
    
    if (touches.length === 1) {
        // Single touch - start pan
        isPanning = true;
        panStart.x = touches[0].clientX;
        panStart.y = touches[0].clientY;
        panStartOffset.x = currentPan.x;
        panStartOffset.y = currentPan.y;
        
        document.querySelector('.layout-wrapper').classList.add('panning');
    } else if (touches.length === 2) {
        // Two touches - start zoom
        isPanning = false;
        isZooming = true;
        
        const distance = getTouchDistance(touches[0], touches[1]);
        lastTouchDistance = distance;
        
        document.querySelector('.layout-wrapper').classList.add('zooming');
    }
}

/**
 * Handle touch move for mobile gestures
 */
function handleTouchMoveGesture(e) {
    if (editMode) return;
    
    e.preventDefault();
    const touches = e.touches;
    
    if (isPanning && touches.length === 1) {
        // Pan gesture
        const deltaX = touches[0].clientX - panStart.x;
        const deltaY = touches[0].clientY - panStart.y;
        
        currentPan.x = panStartOffset.x + deltaX;
        currentPan.y = panStartOffset.y + deltaY;
        
        updateZoomPan();
    } else if (isZooming && touches.length === 2) {
        // Zoom gesture
        const distance = getTouchDistance(touches[0], touches[1]);
        const scale = distance / lastTouchDistance;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * scale));
        
        if (newZoom !== currentZoom) {
            // Get center point between touches
            const centerX = (touches[0].clientX + touches[1].clientX) / 2;
            const centerY = (touches[0].clientY + touches[1].clientY) / 2;
            
            const wrapper = document.querySelector('.layout-wrapper');
            const rect = wrapper.getBoundingClientRect();
            const localCenterX = centerX - rect.left;
            const localCenterY = centerY - rect.top;
            
            // Zoom towards center point
            const zoomRatio = newZoom / currentZoom;
            currentPan.x = localCenterX - (localCenterX - currentPan.x) * zoomRatio;
            currentPan.y = localCenterY - (localCenterY - currentPan.y) * zoomRatio;
            currentZoom = newZoom;
            
            updateZoomPan();
            lastTouchDistance = distance;
        }
    }
}

/**
 * Handle touch end for mobile gestures
 */
function handleTouchEndGesture(e) {
    if (editMode) return;
    
    if (e.touches.length === 0) {
        isPanning = false;
        isZooming = false;
        
        const wrapper = document.querySelector('.layout-wrapper');
        wrapper.classList.remove('panning', 'zooming');
    } else if (e.touches.length === 1 && isZooming) {
        // Transition from zoom to pan
        isZooming = false;
        isPanning = true;
        
        panStart.x = e.touches[0].clientX;
        panStart.y = e.touches[0].clientY;
        panStartOffset.x = currentPan.x;
        panStartOffset.y = currentPan.y;
        
        document.querySelector('.layout-wrapper').classList.remove('zooming');
        document.querySelector('.layout-wrapper').classList.add('panning');
    }
}

/**
 * Get distance between two touches
 */
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Handle window resize
 */
function handleResize() {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;
    
    if (wasMobile !== isMobile) {
        // Device type changed, reinitialize
        if (isMobile) {
            setTimeout(fitToScreen, 100);
        } else {
            currentZoom = 1;
            currentPan = { x: 0, y: 0 };
            updateZoomPan();
        }
    } else if (isMobile) {
        // Still mobile, refit to screen
        setTimeout(fitToScreen, 100);
    }
}

/**
 * Convert screen coordinates to layout coordinates
 */
function screenToLayoutCoords(screenX, screenY) {
    const wrapper = document.querySelector('.layout-wrapper');
    const wrapperRect = wrapper.getBoundingClientRect();
    
    // Convert to wrapper coordinates
    const wrapperX = screenX - wrapperRect.left;
    const wrapperY = screenY - wrapperRect.top;
    
    // Adjust for zoom and pan
    const layoutX = (wrapperX - currentPan.x) / currentZoom;
    const layoutY = (wrapperY - currentPan.y) / currentZoom;
    
    return { x: layoutX, y: layoutY };
}

/**
 * Toggle edit mode on/off
 */
function toggleEditMode() {
    editMode = !editMode;
    const btn = document.querySelector('.btn-edit');
    const info = document.getElementById('editInfo');
    const areas = document.querySelectorAll('.background-area');
    
    if (editMode) {
        btn.innerHTML = '<i class="fas fa-edit me-1"></i>Edit Mode: ON';
        btn.classList.add('active');
        info.classList.add('active');
        areas.forEach(area => area.classList.add('editable'));
        enableDragAndDrop();
        enableResize();
    } else {
        btn.innerHTML = '<i class="fas fa-edit me-1"></i>Edit Mode: OFF';
        btn.classList.remove('active');
        info.classList.remove('active');
        areas.forEach(area => area.classList.remove('editable'));
        disableDragAndDrop();
        disableResize();
    }
}

/**
 * Enable drag and drop functionality
 */
function enableDragAndDrop() {
    const moveable = document.querySelectorAll('.stall, .door, .power-box, .background-area');
    const container = document.getElementById('layoutContainer');
    
    moveable.forEach(element => {
        element.style.cursor = 'move';
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });
        element.addEventListener('mousedown', handleMouseStart);
    });
    
    // Add selection box handlers to container only
    container.addEventListener('mousedown', handleSelectionStart);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseEnd);
}

/**
 * Disable drag and drop functionality
 */
function disableDragAndDrop() {
    const moveable = document.querySelectorAll('.stall, .door, .power-box, .background-area');
    const container = document.getElementById('layoutContainer');
    
    moveable.forEach(element => {
        element.style.cursor = 'pointer';
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('mousedown', handleMouseStart);
    });
    
    container.removeEventListener('mousedown', handleSelectionStart);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseEnd);
    
    clearSelection();
}

/**
 * Enable resize functionality for background areas
 */
function enableResize() {
    const handles = document.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('touchstart', handleResizeStart, { passive: false });
        handle.addEventListener('mousedown', handleResizeStart);
    });
}

/**
 * Disable resize functionality
 */
function disableResize() {
    const handles = document.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        handle.removeEventListener('touchstart', handleResizeStart);
        handle.removeEventListener('mousedown', handleResizeStart);
    });
}

// ==================== MOUSE/TOUCH EVENT HANDLERS ====================

/**
 * Handle mouse down events
 */
function handleMouseStart(e) {
    if (!editMode) return;
    if (e.target.classList.contains('resize-handle')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Check if this is a ctrl+click on a stall for selection
    if (e.target.classList.contains('stall') && (e.ctrlKey || e.metaKey)) {
        toggleStallSelection(e.target);
        return; // Don't start dragging
    }
    
    // If clicking on a stall without ctrl, select it (clear others first if not already selected)
    if (e.target.classList.contains('stall')) {
        if (!selectedStalls.has(e.target)) {
            if (!e.shiftKey) clearSelection();
            selectStall(e.target);
        }
        
        // Check if we should start group drag
        if (selectedStalls.size > 1) {
            groupSelected();
            startGroupDrag(e.clientX, e.clientY);
            return;
        }
    }
    
    // Start individual drag
    startDrag(e.target, e.clientX, e.clientY);
}

/**
 * Handle selection box start
 */
function handleSelectionStart(e) {
    if (!editMode) return;
    
    // Only start area selection if clicking on empty container space
    if (e.target.id !== 'layoutContainer') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isSelecting = true;
    const coords = screenToLayoutCoords(e.clientX, e.clientY);
    
    selectionStart.x = coords.x;
    selectionStart.y = coords.y;
    
    const selectionBox = document.getElementById('selectionBox');
    selectionBox.style.left = coords.x + 'px';
    selectionBox.style.top = coords.y + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
    
    // Clear selection if not holding ctrl
    if (!e.ctrlKey && !e.metaKey) {
        clearSelection();
    }
}

/**
 * Handle touch start events
 */
function handleTouchStart(e) {
    if (!editMode) {
        handleTouchStartGesture(e);
        return;
    }
    
    if (e.target.classList.contains('resize-handle')) return;
    
    e.preventDefault();
    
    if (e.target.classList.contains('stall') && selectedStalls.has(e.target) && selectedStalls.size > 1) {
        groupSelected();
        startGroupDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else {
        startDrag(e.target, e.touches[0].clientX, e.touches[0].clientY);
    }
}

/**
 * Handle mouse move events
 */
function handleMouseMove(e) {
    if (!editMode) return;
    
    if (isSelecting) {
        handleSelectionMove(e);
    } else if (groupDragging) {
        updateGroupDrag(e.clientX, e.clientY);
    } else if (draggedElement) {
        updateDrag(e.clientX, e.clientY);
    }
}

/**
 * Handle touch move events
 */
function handleTouchMove(e) {
    if (!editMode) {
        handleTouchMoveGesture(e);
        return;
    }
    
    e.preventDefault();
    
    if (groupDragging) {
        updateGroupDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (draggedElement) {
        updateDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
}

/**
 * Handle mouse up events
 */
function handleMouseEnd(e) {
    if (isSelecting) {
        handleSelectionEnd(e);
    } else {
        endDrag();
    }
}

/**
 * Handle touch end events
 */
function handleTouchEnd(e) {
    if (!editMode) {
        handleTouchEndGesture(e);
        return;
    }
    
    endDrag();
}

// ==================== DRAG FUNCTIONALITY ====================

/**
 * Start dragging an element
 */
function startDrag(element, clientX, clientY) {
    draggedElement = element;
    const rect = element.getBoundingClientRect();
    const container = document.getElementById('layoutContainer');
    const containerRect = container.getBoundingClientRect();
    
    startPos.x = clientX;
    startPos.y = clientY;
    
    // Account for zoom and pan
    const coords = screenToLayoutCoords(rect.left, rect.top);
    elementPos.x = coords.x;
    elementPos.y = coords.y;
    
    element.classList.add('dragging');
}

/**
 * Start group drag
 */
function startGroupDrag(clientX, clientY) {
    startPos.x = clientX;
    startPos.y = clientY;
}

/**
 * Update drag position
 */
function updateDrag(clientX, clientY) {
    const deltaX = (clientX - startPos.x) / currentZoom;
    const deltaY = (clientY - startPos.y) / currentZoom;
    
    const newX = Math.max(0, elementPos.x + deltaX);
    const newY = Math.max(0, elementPos.y + deltaY);
    
    draggedElement.style.left = newX + 'px';
    draggedElement.style.top = newY + 'px';
}

/**
 * Update group drag positions
 */
function updateGroupDrag(clientX, clientY) {
    const deltaX = (clientX - startPos.x) / currentZoom;
    const deltaY = (clientY - startPos.y) / currentZoom;
    
    selectedStalls.forEach(stall => {
        const originalPos = groupStartPositions.get(stall);
        if (originalPos) {
            const newX = Math.max(0, originalPos.x + deltaX);
            const newY = Math.max(0, originalPos.y + deltaY);
            
            stall.style.left = newX + 'px';
            stall.style.top = newY + 'px';
        }
    });
}

/**
 * End drag operation
 */
function endDrag() {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }
    
    if (groupDragging) {
        selectedStalls.forEach(stall => {
            stall.classList.remove('dragging');
        });
        groupDragging = false;
        groupStartPositions.clear();
    }
}

// ==================== SELECTION FUNCTIONALITY ====================

/**
 * Handle selection box movement
 */
function handleSelectionMove(e) {
    const coords = screenToLayoutCoords(e.clientX, e.clientY);
    
    const selectionBox = document.getElementById('selectionBox');
    const left = Math.min(selectionStart.x, coords.x);
    const top = Math.min(selectionStart.y, coords.y);
    const width = Math.abs(coords.x - selectionStart.x);
    const height = Math.abs(coords.y - selectionStart.y);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    // Only select stalls if we've moved a reasonable distance
    if (width > 10 || height > 10) {
        // Highlight stalls within selection
        const stalls = document.querySelectorAll('.stall');
        stalls.forEach(stall => {
            const stallLeft = parseFloat(stall.style.left);
            const stallTop = parseFloat(stall.style.top);
            const stallWidth = parseFloat(getComputedStyle(stall).width);
            const stallHeight = parseFloat(getComputedStyle(stall).height);
            const stallRight = stallLeft + stallWidth;
            const stallBottom = stallTop + stallHeight;
            
            if (stallLeft >= left && stallTop >= top && stallRight <= left + width && stallBottom <= top + height) {
                if (!selectedStalls.has(stall)) {
                    selectStall(stall);
                }
            }
        });
    }
}

/**
 * Handle selection box end
 */
function handleSelectionEnd(e) {
    isSelecting = false;
    const selectionBox = document.getElementById('selectionBox');
    selectionBox.style.display = 'none';
}

/**
 * Select a stall
 */
function selectStall(stall) {
    selectedStalls.add(stall);
    stall.classList.add('selected');
    updateSelectionTools();
}

/**
 * Deselect a stall
 */
function deselectStall(stall) {
    selectedStalls.delete(stall);
    stall.classList.remove('selected');
    updateSelectionTools();
}

/**
 * Toggle stall selection
 */
function toggleStallSelection(stall) {
    if (selectedStalls.has(stall)) {
        deselectStall(stall);
    } else {
        selectStall(stall);
    }
}

/**
 * Clear all selections
 */
function clearSelection() {
    selectedStalls.forEach(stall => {
        stall.classList.remove('selected');
    });
    selectedStalls.clear();
    updateSelectionTools();
}

/**
 * Update selection tools visibility and count
 */
function updateSelectionTools() {
    const tools = document.getElementById('selectionTools');
    const count = document.getElementById('selectionCount');
    
    if (selectedStalls.size > 0) {
        tools.classList.add('active');
        count.textContent = `${selectedStalls.size} stall${selectedStalls.size > 1 ? 's' : ''} selected`;
    } else {
        tools.classList.remove('active');
    }
}

/**
 * Prepare selected stalls for group movement
 */
function groupSelected() {
    if (selectedStalls.size === 0) return;
    
    groupDragging = true;
    groupStartPositions.clear();
    
    // Store initial positions in layout coordinates
    selectedStalls.forEach(stall => {
        groupStartPositions.set(stall, {
            x: parseFloat(stall.style.left) || 0,
            y: parseFloat(stall.style.top) || 0
        });
        
        stall.classList.add('dragging');
    });
}

// ==================== RESIZE FUNCTIONALITY ====================

/**
 * Handle resize start
 */
function handleResizeStart(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    resizingElement = e.target.parentElement;
    const rect = resizingElement.getBoundingClientRect();
    
    startPos.x = e.touches ? e.touches[0].clientX : e.clientX;
    startPos.y = e.touches ? e.touches[0].clientY : e.clientY;
    startSize.width = rect.width;
    startSize.height = rect.height;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('touchmove', handleResizeMove, { passive: false });
    document.addEventListener('touchend', handleResizeEnd);
}

/**
 * Handle resize movement
 */
function handleResizeMove(e) {
    if (!resizingElement) return;
    e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const deltaX = (clientX - startPos.x) / currentZoom;
    const deltaY = (clientY - startPos.y) / currentZoom;
    
    const newWidth = Math.max(80, startSize.width + deltaX);
    const newHeight = Math.max(60, startSize.height + deltaY);
    
    resizingElement.style.width = newWidth + 'px';
    resizingElement.style.height = newHeight + 'px';
}

/**
 * Handle resize end
 */
function handleResizeEnd(e) {
    resizingElement = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('touchmove', handleResizeMove);
    document.removeEventListener('touchend', handleResizeEnd);
}

// ==================== STALL EDITING ====================

/**
 * Handle stall number editing
 */
function initializeStallEditing() {
    // Double tap to edit numbers
    let tapTimeout;
    document.addEventListener('touchend', function(e) {
        if (!editMode || !e.target.classList.contains('stall')) return;
        
        if (tapTimeout) {
            clearTimeout(tapTimeout);
            tapTimeout = null;
            editStallNumber(e.target);
        } else {
            tapTimeout = setTimeout(() => {
                tapTimeout = null;
            }, 300);
        }
    });

    // Double click for desktop
    document.addEventListener('dblclick', function(e) {
        if (!editMode || !e.target.classList.contains('stall')) return;
        editStallNumber(e.target);
    });
}

/**
 * Edit stall number
 */
function editStallNumber(stall) {
    const currentNumber = stall.textContent;
    const newNumber = prompt('Edit stall number:', currentNumber);
    if (newNumber !== null && newNumber.trim() !== '') {
        stall.textContent = newNumber.trim();
    }
}

// ==================== INITIALIZATION ====================

/**
 * Initialize all functionality when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeZoomPan();
    initializeStallEditing();
    
    // Prevent context menu on long press during edit mode
    document.addEventListener('contextmenu', function(e) {
        if (editMode && (e.target.classList.contains('stall') || 
                        e.target.classList.contains('door') || 
                        e.target.classList.contains('power-box'))) {
            e.preventDefault();
        }
    });
    
    // Add timestamp for printing
    const container = document.getElementById('layoutContainer');
    if (container) {
        container.setAttribute('data-print-time', new Date().toLocaleString());
    }
    
    console.log('Responsive drag handler with zoom/pan initialized successfully');
});