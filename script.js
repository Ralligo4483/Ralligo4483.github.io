/**
 * Stock & Shopping Manager Logic
 */

// State
let items = [];
const STORAGE_KEY = 'stock_manager_data';
const PREFS_KEY = 'stock_manager_prefs'; // Local config (view mode)
const API_KEY_STORAGE = 'gemini_api_key';
const GROQ_API_KEY_STORAGE = 'groq_api_key';
const AI_PROVIDER_STORAGE = 'ai_provider'; // 'gemini' or 'groq'

// DOM Elements
const inventoryListEl = document.getElementById('inventory-list');
const shoppingListEl = document.getElementById('shopping-list');
const modal = document.getElementById('item-modal');
const settingsModal = document.getElementById('settings-modal');
const loadingOverlay = document.getElementById('loading-overlay');
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
    initScrollHeader();
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

    filteredItems.forEach((item, index) => {
        const isLowStock = item.quantity <= item.threshold || item.quantity === 0;
        const lowStockClass = isLowStock ? 'low-stock' : '';
        const categoryIcon = item.category === 'food' ? 'restaurant-outline' : 'home-outline';

        const card = document.createElement('div');
        card.className = `inventory-item ${item.category} ${lowStockClass}`;
        card.setAttribute('data-id', item.id);
        card.style.setProperty('--i', index);

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

    shoppingItems.forEach((item, index) => {
        const needed = item.threshold - item.quantity;
        const estimatedCost = needed * item.price;

        const card = document.createElement('div');
        card.className = `shopping-item`;
        card.style.setProperty('--i', index);
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

    const invEl = document.getElementById('total-inventory-value');
    const estEl = document.getElementById('estimated-cost');
    invEl.innerText = `¥${totalInventoryVal.toLocaleString()}`;
    estEl.innerText = `¥${totalShoppingEst.toLocaleString()}`;

    // Pulse animation on value change
    invEl.classList.add('value-updated');
    estEl.classList.add('value-updated');
    setTimeout(() => {
        invEl.classList.remove('value-updated');
        estEl.classList.remove('value-updated');
    }, 300);
}

// -- Actions --

function adjustQuantity(id, change) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newQty = Math.max(0, item.quantity + change);
    if (newQty !== item.quantity) {
        // Animate qty text inline (bump effect)
        const card = document.querySelector(`.inventory-item[data-id="${id}"]`);
        if (card) {
            const qtyEl = card.querySelector('.item-qty');
            if (qtyEl) {
                qtyEl.textContent = newQty;
                qtyEl.classList.remove('qty-bump');
                // Force reflow to restart animation
                void qtyEl.offsetWidth;
                qtyEl.classList.add('qty-bump');
            }
        }
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
        animation: 200,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        forceFallback: true,
        fallbackClass: 'sortable-fallback',
        fallbackOnBody: true,
        fallbackTolerance: 3,
        delay: 100,
        delayOnTouchOnly: true,
        touchStartThreshold: 3,
        scroll: true,
        scrollSensitivity: 60,
        scrollSpeed: 10,
        onStart: function () {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        },
        onEnd: function (evt) {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';

            const itemEls = inventoryListEl.children;
            const newOrderIds = Array.from(itemEls).map(el => el.getAttribute('data-id'));

            const reorderedItems = [];
            newOrderIds.forEach(id => {
                const item = items.find(i => i.id === id);
                if (item) reorderedItems.push(item);
            });

            if (reorderedItems.length === items.length) {
                items = reorderedItems;
                saveData();
            } else {
                console.warn('Reorder mismatch, reloading');
                renderInventory();
            }
        }
    });
}

// -- Auto-Hide Header on Scroll --

function initScrollHeader() {
    const header = document.querySelector('.app-header');
    const tabs = document.querySelector('.tabs');
    let lastScrollY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const currentScrollY = window.scrollY;
                if (currentScrollY > lastScrollY && currentScrollY > 80) {
                    // Scrolling DOWN past 80px
                    header.classList.add('header-hidden');
                    tabs.classList.add('header-hidden');
                } else {
                    // Scrolling UP
                    header.classList.remove('header-hidden');
                    tabs.classList.remove('header-hidden');
                }
                lastScrollY = currentScrollY;
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
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

// -- Settings & API Key --

function getSelectedProvider() {
    return localStorage.getItem(AI_PROVIDER_STORAGE) || 'gemini';
}

function onProviderChange() {
    const provider = document.querySelector('input[name="ai-provider"]:checked').value;
    document.getElementById('gemini-settings').style.display = provider === 'gemini' ? '' : 'none';
    document.getElementById('groq-settings').style.display = provider === 'groq' ? '' : 'none';
}

function openSettingsModal() {
    const provider = getSelectedProvider();
    // Set provider radio
    const radios = document.querySelectorAll('input[name="ai-provider"]');
    radios.forEach(r => { if (r.value === provider) r.checked = true; });

    // Load API keys
    document.getElementById('api-key-input').value = localStorage.getItem(API_KEY_STORAGE) || '';
    document.getElementById('groq-api-key-input').value = localStorage.getItem(GROQ_API_KEY_STORAGE) || '';

    // Show/hide provider sections
    onProviderChange();

    settingsModal.classList.add('active');
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

function saveSettings() {
    const provider = document.querySelector('input[name="ai-provider"]:checked').value;
    localStorage.setItem(AI_PROVIDER_STORAGE, provider);

    // Save Gemini key
    const geminiKey = document.getElementById('api-key-input').value.trim();
    if (geminiKey) localStorage.setItem(API_KEY_STORAGE, geminiKey);

    // Save Groq key
    const groqKey = document.getElementById('groq-api-key-input').value.trim();
    if (groqKey) localStorage.setItem(GROQ_API_KEY_STORAGE, groqKey);

    // Check that selected provider has a key
    if (provider === 'gemini' && !geminiKey && !localStorage.getItem(API_KEY_STORAGE)) {
        alert('Gemini APIキーを入力してください');
        return;
    }
    if (provider === 'groq' && !groqKey && !localStorage.getItem(GROQ_API_KEY_STORAGE)) {
        alert('Groq APIキーを入力してください');
        return;
    }

    alert(`設定を保存しました（${provider === 'gemini' ? 'Gemini' : 'Groq'} を使用）`);
    closeSettingsModal();
}

async function checkModels() {
    const provider = document.querySelector('input[name="ai-provider"]:checked').value;

    if (provider === 'groq') {
        alert('Groq 利用可能モデル:\n- llama-3.2-11b-vision-preview\n- llama-3.2-90b-vision-preview');
        return;
    }

    const key = document.getElementById('api-key-input').value.trim() || localStorage.getItem(API_KEY_STORAGE);
    if (!key) {
        alert('APIキーを入力してください');
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();
        const models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));

        const modelNames = models.map(m => m.name.replace('models/', '')).join('\n');
        alert('利用可能なモデル:\n' + modelNames);
        console.log(models);
    } catch (e) {
        alert('モデル一覧の取得に失敗しました: ' + e.message);
    }
}

// -- AI Camera Feature --

async function handleCameraInput(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const provider = getSelectedProvider();

        let apiKey;
        if (provider === 'groq') {
            apiKey = localStorage.getItem(GROQ_API_KEY_STORAGE);
            if (!apiKey) {
                alert('AI機能を使うには、設定からGroq APIキーを登録してください。');
                input.value = '';
                return;
            }
        } else {
            apiKey = localStorage.getItem(API_KEY_STORAGE);
            if (!apiKey) {
                alert('AI機能を使うには、設定からGemini APIキーを登録してください。');
                input.value = '';
                return;
            }
        }

        loadingOverlay.classList.add('active');

        try {
            const base64Image = await convertToBase64(file);
            let result;
            if (provider === 'groq') {
                result = await callGroqAPI(base64Image, apiKey);
            } else {
                result = await callGeminiAPI(base64Image, apiKey);
            }
            handleAIResponse(result);
        } catch (error) {
            console.error(error);
            alert('AI解析に失敗しました: ' + error.message);
        } finally {
            loadingOverlay.classList.remove('active');
            input.value = '';
        }
    }
}

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove "data:image/jpeg;base64," prefix for API
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

async function callGeminiAPI(base64Image, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `
        この画像を解析し、写っている商品の「商品名」「カテゴリ(food または goods)」「推定価格(日本円の数値のみ)」を推定してください。
        回答は必ず以下のJSON形式のみで出力してください。Markdownのコードブロックは不要です。
        { "name": "商品名", "category": "food", "price": 100 }
    `;

    const body = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API Error');
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Clean up potential markdown formatting (```json ... ```)
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
}

async function callGroqAPI(base64Image, apiKey) {
    const model = document.getElementById('groq-model-select')?.value || 'llama-3.2-11b-vision-preview';
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const prompt = `
        この画像を解析し、写っている商品の「商品名」「カテゴリ(food または goods)」「推定価格(日本円の数値のみ)」を推定してください。
        回答は必ず以下のJSON形式のみで出力してください。Markdownのコードブロックは不要です。
        { "name": "商品名", "category": "food", "price": 100 }
    `;

    const body = {
        model: model,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    }
                ]
            }
        ],
        max_tokens: 300
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Groq API Error');
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    // Clean up potential markdown formatting (```json ... ```)
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
}

function handleAIResponse(aiData) {
    // 1. Try to match existing item
    // Simple logic: Exact name match or fuzzy inclusion logic?
    // Let's go with includes logic for better UX
    const existingItem = items.find(i =>
        i.name === aiData.name ||
        i.name.includes(aiData.name) ||
        aiData.name.includes(i.name)
    );

    if (existingItem) {
        // Update stock
        updateItem(existingItem.id, { quantity: existingItem.quantity + 1 });
        const newQty = existingItem.quantity + 1; // updateItem saves async? No, sync in this app.
        // Actually items array is updated in updateItem.
        // We need to fetch it again or careful. 
        // updateItem logic: items[index] = ...; saveData();
        // So safe to say it's updated.
        alert(`「${existingItem.name}」を認識しました。\n在庫を +1 しました (現在: ${items.find(i => i.id === existingItem.id).quantity}個)`);
    } else {
        // New Item
        if (confirm(`「${aiData.name}」は未登録です。\n新規登録しますか？`)) {
            openModal();
            // Pre-fill form
            document.getElementById('item-name').value = aiData.name;
            document.getElementById('item-price').value = aiData.price;

            const radios = document.getElementsByName('category');
            radios.forEach(r => {
                if (r.value === aiData.category) r.checked = true;
            });

            // Suggest threshold? Default 1.
        }
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
