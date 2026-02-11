/**
 * Stock & Shopping Manager Logic
 */

// State
let items = [];
const STORAGE_KEY = 'stock_manager_data';
const PREFS_KEY = 'stock_manager_prefs'; // Local config (view mode)

// DOM Elements
const inventoryListEl = document.getElementById('inventory-list');
const shoppingListEl = document.getElementById('shopping-list');
const modal = document.getElementById('item-modal');
const itemForm = document.getElementById('item-form');
const shoppingBadge = document.getElementById('shopping-badge');
const viewToggleBtn = document.querySelector('.view-toggle-btn');
const viewIcon = document.getElementById('view-icon');

let sortable; // SortableJS instance
let isCompact = false;

// -- Initialization --

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadPrefs();
    renderInventory();
    renderShoppingList();
    updateStats();
    initSortable();
});

// -- Data Management --

function loadPrefs() {
    const prefs = localStorage.getItem(PREFS_KEY);
    if (prefs) {
        const p = JSON.parse(prefs);
        isCompact = p.isCompact || false;
        applyViewMode();
    }
}

function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ isCompact }));
}

function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        items = JSON.parse(data);
    } else {
        // Initial dummy data for first-time use
        items = [
            { id: '1', name: '牛乳', category: 'food', quantity: 1, threshold: 2, price: 230 },
            { id: '2', name: '卵', category: 'food', quantity: 0, threshold: 1, price: 280 },
            { id: '3', name: '洗濯洗剤', category: 'goods', quantity: 1, threshold: 1, price: 450 }
        ];
        saveData();
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    renderInventory();
    renderShoppingList();
    updateStats();
}

function addItem(item) {
    items.push(item);
    saveData();
}

function updateItem(id, updates) {
    const index = items.findIndex(i => i.id === id);
    if (index > -1) {
        items[index] = { ...items[index], ...updates };
        saveData();
    }
}

function deleteItemData(id) {
    items = items.filter(i => i.id !== id);
    saveData();
}

// -- UI Rendering --

let currentFilter = 'all';

function renderInventory() {
    inventoryListEl.innerHTML = '';

    // Filter items
    const filteredItems = items.filter(item => {
        if (currentFilter === 'all') return true;
        return item.category === currentFilter;
    });

    if (filteredItems.length === 0) {
        inventoryListEl.innerHTML = `
            <div class="empty-state">
                <ion-icon name="cube-outline"></ion-icon>
                <p>アイテムがありません</p>
            </div>`;
        return;
    }

    filteredItems.forEach(item => {
        const isLowStock = item.quantity <= item.threshold || item.quantity === 0;
        const lowStockClass = isLowStock ? 'low-stock' : '';
        const categoryIcon = item.category === 'food' ? 'restaurant-outline' : 'home-outline';

        const card = document.createElement('div');
        card.className = `inventory-item ${item.category} ${lowStockClass}`;
        card.setAttribute('data-id', item.id); // For SortableJS

        card.innerHTML = `
            <div class="drag-handle"><ion-icon name="menu-outline"></ion-icon></div>
            <div class="item-info" onclick="openModal('${item.id}')">
                <div class="item-name">${item.name}</div>
                <div class="item-meta">
                    <span><ion-icon name="${categoryIcon}"></ion-icon></span>
                    <span>単価: ¥${item.price}</span>
                    <span>適正: ${item.threshold}</span>
                </div>
            </div>
            <div class="item-controls">
                <button class="btn-icon" onclick="adjustQuantity('${item.id}', -1)">
                    <ion-icon name="remove"></ion-icon>
                </button>
                <span class="item-qty">${item.quantity}</span>
                <button class="btn-icon" onclick="adjustQuantity('${item.id}', 1)">
                    <ion-icon name="add"></ion-icon>
                </button>
            </div>
        `;
        inventoryListEl.appendChild(card);
    });
}

function renderShoppingList() {
    shoppingListEl.innerHTML = '';

    // Filter items that need to be bought
    // Logic: Quantity < Threshold OR Quantity is 0 (if threshold > 0)
    const shoppingItems = items.filter(item => item.quantity < item.threshold);

    // Update Badge
    if (shoppingItems.length > 0) {
        shoppingBadge.innerText = shoppingItems.length;
        shoppingBadge.style.display = 'inline-block';
    } else {
        shoppingBadge.style.display = 'none';
    }

    if (shoppingItems.length === 0) {
        shoppingListEl.innerHTML = `
            <div class="empty-state">
                <ion-icon name="cart-outline"></ion-icon>
                <p>買うものはありません</p>
            </div>`;
        return;
    }

    shoppingItems.forEach(item => {
        const needed = item.threshold - item.quantity;
        const estimatedCost = needed * item.price;

        const card = document.createElement('div');
        card.className = `shopping-item`;
        // Check local storage for checked state to persist checkboxes during navigation
        const isChecked = localStorage.getItem(`checked_${item.id}`) === 'true';
        if (isChecked) card.classList.add('checked');

        card.innerHTML = `
            <input type="checkbox" class="shopping-checkbox" 
                ${isChecked ? 'checked' : ''} 
                onchange="toggleCheck(this, '${item.id}')">
            <div class="shopping-details">
                <div class="name">${item.name}</div>
                <div class="cost">不足: ${needed}個 × ¥${item.price} = <strong>¥${estimatedCost}</strong></div>
            </div>
        `;
        shoppingListEl.appendChild(card);
    });
}

function updateStats() {
    let totalInventoryVal = 0;
    let totalShoppingEst = 0;

    items.forEach(item => {
        // Total Inventory Value
        totalInventoryVal += item.quantity * item.price;

        // Shopping Estimate
        if (item.quantity < item.threshold) {
            const needed = item.threshold - item.quantity;
            totalShoppingEst += needed * item.price;
        }
    });

    document.getElementById('total-inventory-value').innerText = `¥${totalInventoryVal.toLocaleString()}`;
    document.getElementById('estimated-cost').innerText = `¥${totalShoppingEst.toLocaleString()}`;
}

// -- Actions --

function adjustQuantity(id, change) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newQty = Math.max(0, item.quantity + change);
    if (newQty !== item.quantity) {
        updateItem(id, { quantity: newQty });
    }
}

function toggleCheck(checkbox, id) {
    const parent = checkbox.closest('.shopping-item');
    if (checkbox.checked) {
        parent.classList.add('checked');
        localStorage.setItem(`checked_${id}`, 'true');
    } else {
        parent.classList.remove('checked');
        localStorage.removeItem(`checked_${id}`);
    }
}

function clearCheckedShoppingItems() {
    // This function removes "checked" status, 
    // AND optionally could act as "Bought" (increasing stock).
    // For now, let's just interpret as "Done shopping", so we might want to update stock?
    // Requirement says: "Shopping List... Checkboxes...".
    // Usually, checking off means "Put in basket".
    // Let's implement a feature: When "Clear Bought" is clicked, ask if we should update stock.
    // For simplicity V1: Just clear the checks.

    // Better UX: Iterate checked items, add to stock, remove check.
    const checkboxes = document.querySelectorAll('.shopping-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm('チェックした商品を在庫に追加しますか？')) return;

    checkboxes.forEach(cb => {
        // Find ID from the onchange handler attribute or store it differently
        // HACK: Re-parsing the ID from the onclick is messy. Let's look at the parent loop.
        // Actually, let's iterate our data and check localStorage keys.
    });

    // Optimized way:
    items.forEach(item => {
        if (localStorage.getItem(`checked_${item.id}`) === 'true') {
            const needed = Math.max(0, item.threshold - item.quantity);
            // Assume we bought the exact needed amount? Or just +needed?
            // "Estimated amount" logic was based on threshold - quantity.
            // Let's create `buyItem` logic. 
            // Update quantity
            if (needed > 0) {
                updateItem(item.id, { quantity: item.quantity + needed });
            }
            // Clear check
            localStorage.removeItem(`checked_${item.id}`);
        }
    });

    renderInventory();
    renderShoppingList();
}

// -- Filtering --

function filterInventory(category) {
    currentFilter = category;

    // update active chip
    document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active'); // Event bubbling relies on click

    renderInventory();

    // Sortable re-enable check
    // If filter is active, disable sorting to avoid confusion (Visual order != Saved order)
    if (currentFilter !== 'all') {
        if (sortable) sortable.option("disabled", true);
    } else {
        if (sortable) sortable.option("disabled", false);
    }
}

// -- View Mode --

function toggleCompactMode() {
    isCompact = !isCompact;
    savePrefs();
    applyViewMode();
}

function applyViewMode() {
    if (isCompact) {
        inventoryListEl.classList.add('compact');
        viewToggleBtn.classList.add('active');
        viewIcon.setAttribute('name', 'grid-outline'); // Switch icon to show current state? Or target state? 
        // Let's use 'grid-outline' for compact active
    } else {
        inventoryListEl.classList.remove('compact');
        viewToggleBtn.classList.remove('active');
        viewIcon.setAttribute('name', 'list-outline');
    }
}

// -- Reordering --

function initSortable() {
    sortable = new Sortable(inventoryListEl, {
        animation: 150,
        handle: '.drag-handle', // Drag handle selector
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            // Get new order from DOM
            const itemEls = inventoryListEl.children;
            const newOrderIds = Array.from(itemEls).map(el => el.getAttribute('data-id'));

            // Reorder 'items' array based on newOrderIds
            const reorderedItems = [];
            newOrderIds.forEach(id => {
                const item = items.find(i => i.id === id);
                if (item) reorderedItems.push(item);
            });

            // Should verify we didn't lose items (e.g. if filtered view but logic prevents it)
            if (reorderedItems.length === items.length) {
                items = reorderedItems;
                saveData();
            } else {
                console.warn('Reorder mismatch, reloading');
                renderInventory(); // Revert visual
            }
        }
    });
}

// -- Modal / Form --

function openModal(itemId = null) {
    modal.classList.add('active');

    if (itemId) {
        const item = items.find(i => i.id === itemId);
        document.getElementById('modal-title').innerText = 'アイテム編集';
        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-quantity').value = item.quantity;
        document.getElementById('item-threshold').value = item.threshold;
        document.getElementById('item-price').value = item.price;

        // Radio
        const radios = document.getElementsByName('category');
        radios.forEach(r => {
            if (r.value === item.category) r.checked = true;
        });

        document.getElementById('delete-btn').style.display = 'block';
    } else {
        document.getElementById('modal-title').innerText = 'アイテム登録';
        itemForm.reset();
        document.getElementById('item-id').value = '';
        document.getElementById('item-quantity').value = 1;
        document.getElementById('item-threshold').value = 1;
        document.getElementById('delete-btn').style.display = 'none';
    }
}

function closeModal() {
    modal.classList.remove('active');
}

function adjustFormValue(inputId, change) {
    const input = document.getElementById(inputId);
    const val = parseInt(input.value) || 0;
    input.value = Math.max(0, val + change);
}

function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('item-id').value;
    const name = document.getElementById('item-name').value;
    const category = document.querySelector('input[name="category"]:checked').value;
    const quantity = parseInt(document.getElementById('item-quantity').value);
    const threshold = parseInt(document.getElementById('item-threshold').value);
    const price = parseInt(document.getElementById('item-price').value) || 0;

    if (id) {
        updateItem(id, { name, category, quantity, threshold, price });
    } else {
        const newItem = {
            id: Date.now().toString(),
            name,
            category,
            quantity,
            threshold,
            price
        };
        addItem(newItem);
    }

    closeModal();
}

function deleteItem() {
    const id = document.getElementById('item-id').value;
    if (id && confirm('本当に削除しますか？')) {
        deleteItemData(id);
        closeModal();
    }
}

// -- Tabs --

window.switchTab = function (tabName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

    // Deactivate all tabs
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Activate target
    document.getElementById(`${tabName}-view`).classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
};
