// Select elements
const items = document.querySelectorAll('.item');
const dropZone = document.getElementById('dropZone');
let draggedElement = null;

// Add event listeners for drag events
items.forEach(item => {
    item.addEventListener('dragstart', dragStart);
    item.addEventListener('dragend', dragEnd);
});

dropZone.addEventListener('dragover', dragOver);
dropZone.addEventListener('dragenter', dragEnter);
dropZone.addEventListener('dragleave', dragLeave);
dropZone.addEventListener('drop', dropItem);

// Update items when they're added to the drop zone
function updateItemListeners() {
    const allItems = document.querySelectorAll('.item');
    allItems.forEach(item => {
        item.removeEventListener('dragstart', dragStart);
        item.removeEventListener('dragend', dragEnd);
        item.addEventListener('dragstart', dragStart);
        item.addEventListener('dragend', dragEnd);
    });
}

// Functions to handle drag events
function dragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.id);
}

function dragEnd(e) {
    draggedElement = null;
    this.style.opacity = '1';
    dropZone.classList.remove('drag-over');
}

function dragEnter(e) {
    if (draggedElement) {
        dropZone.classList.add('drag-over');
    }
}

function dragLeave(e) {
    if (e.target === dropZone) {
        dropZone.classList.remove('drag-over');
    }
}

function dragOver(e) {
    e.preventDefault(); // This is necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function dropItem(e) {
    e.preventDefault(); // Prevent default behavior
    e.stopPropagation();
    
    const id = e.dataTransfer.getData('text/plain');
    const draggedItem = document.getElementById(id);
    
    if (draggedItem) {
        dropZone.appendChild(draggedItem);
        draggedItem.style.opacity = '1';
        updateItemListeners();
    }
    
    dropZone.classList.remove('drag-over');
    return false;
}
