/**
 * QMRCC Receipt Generator Pro
 * Client-side application using localStorage
 */

(function() {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        SESSION_KEY: 'qmrcc_session',
        PASSWORD_KEY: 'qmrcc_password',
        TEMPLATES_KEY: 'qmrcc_templates',
        ENTRIES_KEY: 'qmrcc_entries',
        DEFAULT_PASSWORD: 'admin123',
        SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    };

    // Currency symbols
    const CURRENCY_SYMBOLS = {
        INR: '₹',
        AED: 'د.إ',
        SAR: '﷼',
    };

    // ========================================
    // Utility Functions
    // ========================================

    // Hash password using SHA-256 (via SubtleCrypto API)
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Generate random token
    function generateToken() {
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Show toast notification
    function showToast(message, type = 'info') {
        const toastEl = document.getElementById('toastEl');
        const toastMessage = document.getElementById('toastMessage');
        
        toastEl.className = `toast align-items-center border-0 ${type}`;
        toastMessage.textContent = message;
        
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    // Format date for display
    function formatDateTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    // ========================================
    // Storage Functions
    // ========================================

    function getFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage read error:', e);
            return null;
        }
    }

    function saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage write error:', e);
            return false;
        }
    }

    function removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage delete error:', e);
            return false;
        }
    }

    // ========================================
    // Authentication Functions
    // ========================================

    // Initialize password if not exists
    async function initializePassword() {
        let storedPassword = getFromStorage(CONFIG.PASSWORD_KEY);
        if (!storedPassword) {
            const hashedDefault = await hashPassword(CONFIG.DEFAULT_PASSWORD);
            saveToStorage(CONFIG.PASSWORD_KEY, hashedDefault);
        }
    }

    // Verify password
    async function verifyPassword(password) {
        const storedPassword = getFromStorage(CONFIG.PASSWORD_KEY);
        const hashedInput = await hashPassword(password);
        return storedPassword === hashedInput;
    }

    // Update password
    async function updatePassword(newPassword) {
        const hashedPassword = await hashPassword(newPassword);
        return saveToStorage(CONFIG.PASSWORD_KEY, hashedPassword);
    }

    // Create session
    function createSession() {
        const token = generateToken();
        const expiresAt = Date.now() + CONFIG.SESSION_DURATION;
        saveToStorage(CONFIG.SESSION_KEY, { token, expiresAt });
        return token;
    }

    // Verify session
    function verifySession() {
        const session = getFromStorage(CONFIG.SESSION_KEY);
        if (!session) return false;
        
        if (Date.now() > session.expiresAt) {
            removeFromStorage(CONFIG.SESSION_KEY);
            return false;
        }
        
        return true;
    }

    // Destroy session
    function destroySession() {
        removeFromStorage(CONFIG.SESSION_KEY);
    }

    // ========================================
    // Template Functions
    // ========================================

    function getTemplates() {
        return getFromStorage(CONFIG.TEMPLATES_KEY) || [];
    }

    function saveTemplates(templates) {
        return saveToStorage(CONFIG.TEMPLATES_KEY, templates);
    }

    function addTemplate(name, imageData, mimeType = 'image/png') {
        const templates = getTemplates();
        const newTemplate = {
            id: generateToken(),
            name,
            imageData,
            mimeType,
            isActive: true,
            usageCount: 0, // Track usage
            createdAt: new Date().toISOString(),
        };
        templates.push(newTemplate);
        saveTemplates(templates);
        return newTemplate;
    }

    function updateTemplate(id, updates) {
        const templates = getTemplates();
        const index = templates.findIndex(t => t.id === id);
        if (index !== -1) {
            templates[index] = { ...templates[index], ...updates, updatedAt: new Date().toISOString() };
            saveTemplates(templates);
            return templates[index];
        }
        return null;
    }

    function deleteTemplate(id) {
        const templates = getTemplates();
        const filtered = templates.filter(t => t.id !== id);
        return saveTemplates(filtered);
    }

    function incrementTemplateUsage(templateId) {
        if (!templateId) return;
        const templates = getTemplates();
        const index = templates.findIndex(t => t.id === templateId);
        if (index !== -1) {
            templates[index].usageCount = (templates[index].usageCount || 0) + 1;
            saveTemplates(templates);
        }
    }

    // ========================================
    // Receipt Entries Functions
    // ========================================

    function getEntries() {
        return getFromStorage(CONFIG.ENTRIES_KEY) || [];
    }

    function saveEntries(entries) {
        return saveToStorage(CONFIG.ENTRIES_KEY, entries);
    }

    function addEntry(data) {
        const entries = getEntries();
        const newEntry = {
            id: generateToken(),
            receiptNumber: data.receiptNumber,
            payerName: data.payerName,
            amount: data.amount,
            currency: data.currency,
            formattedAmount: data.formattedAmount,
            templateId: data.templateId,
            templateName: data.templateName,
            createdAt: new Date().toISOString(),
        };
        entries.unshift(newEntry); // Add to beginning
        saveEntries(entries);
        
        // Increment template usage
        incrementTemplateUsage(data.templateId);
        
        return newEntry;
    }

    function deleteEntry(id) {
        const entries = getEntries();
        const filtered = entries.filter(e => e.id !== id);
        return saveEntries(filtered);
    }

    function clearAllEntries() {
        return saveToStorage(CONFIG.ENTRIES_KEY, []);
    }

    function getEntriesStats() {
        const entries = getEntries();
        const totalEntries = entries.length;
        const totalAmount = entries.reduce((sum, entry) => {
            return sum + parseFloat(entry.amount || 0);
        }, 0);
        
        // Get entries by currency
        const byCurrency = entries.reduce((acc, entry) => {
            acc[entry.currency] = (acc[entry.currency] || 0) + parseFloat(entry.amount || 0);
            return acc;
        }, {});
        
        return { totalEntries, totalAmount, byCurrency };
    }

    // ========================================
    // Receipt Generation
    // ========================================

    function generateReceiptNumber() {
        return `RCP-${Date.now().toString(36).toUpperCase()}`;
    }

    function formatDate() {
        return new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    function formatAmount(amount, currency) {
        const symbol = CURRENCY_SYMBOLS[currency] || '$';
        const num = parseFloat(amount);
        return `${symbol}${num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    async function drawReceipt(templateImage, data) {
        const canvas = document.getElementById('receiptCanvas');
        const ctx = canvas.getContext('2d');

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw template
                ctx.drawImage(img, 0, 0);

                // Configure text style
                ctx.fillStyle = '#000000';
                ctx.textBaseline = 'top';

                // Calculate positions based on image size
                const rightMargin = canvas.width * 0.08;
                const leftMargin = canvas.width * 0.08;
                const startY = canvas.height * 0.35;
                const lineHeight = canvas.height * 0.05;

                // Draw receipt number
                ctx.font = `bold ${Math.max(14, canvas.width * 0.018)}px 'Rubik', sans-serif`;
                ctx.textAlign = 'right';
                ctx.fillText(`Receipt #: ${data.receiptNumber}`, canvas.width - rightMargin, startY);

                // Draw date
                ctx.font = `${Math.max(12, canvas.width * 0.015)}px 'Rubik', sans-serif`;
                ctx.fillText(`Date: ${data.date}`, canvas.width - rightMargin, startY + lineHeight);

                // Draw payer name
                ctx.textAlign = 'left';
                ctx.font = `${Math.max(14, canvas.width * 0.017)}px 'Rubik', sans-serif`;
                ctx.fillText(`Received from: ${data.payerName}`, leftMargin, startY + lineHeight * 3);

                // Draw amount
                ctx.font = `bold ${Math.max(18, canvas.width * 0.025)}px 'Rubik', sans-serif`;
                ctx.fillText(`Amount: ${data.formattedAmount}`, leftMargin, startY + lineHeight * 5);

                resolve();
            };
            img.src = templateImage;
        });
    }

    // ========================================
    // UI Functions
    // ========================================

    function showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    function showApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }

    function renderTemplatesList() {
        const templates = getTemplates();
        const container = document.getElementById('templatesList');
        const noTemplates = document.getElementById('noTemplates');

        if (templates.length === 0) {
            container.innerHTML = '';
            noTemplates.classList.remove('hidden');
            return;
        }

        noTemplates.classList.add('hidden');
        container.innerHTML = templates.map(template => `
            <div class="col-md-6 col-lg-4">
                <div class="template-card">
                    <img src="${template.imageData}" alt="${template.name}">
                    <div class="template-name">${template.name}</div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge ${template.isActive ? 'bg-success' : 'bg-secondary'}">
                            ${template.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span class="badge bg-info">
                            <i class="fas fa-chart-bar me-1"></i>${template.usageCount || 0} uses
                        </span>
                    </div>
                    <div class="template-actions">
                        <button class="btn btn-outline-${template.isActive ? 'warning' : 'success'} btn-sm toggle-template" 
                                data-id="${template.id}" data-active="${template.isActive}">
                            <i class="fas fa-${template.isActive ? 'pause' : 'play'}"></i>
                            ${template.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-outline-danger btn-sm delete-template" data-id="${template.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners
        document.querySelectorAll('.toggle-template').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const isActive = btn.dataset.active === 'true';
                updateTemplate(id, { isActive: !isActive });
                renderTemplatesList();
                renderTemplateSelect();
                showToast(`Template ${!isActive ? 'activated' : 'deactivated'}`, 'success');
            });
        });

        document.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this template?')) {
                    deleteTemplate(btn.dataset.id);
                    renderTemplatesList();
                    renderTemplateSelect();
                    showToast('Template deleted successfully', 'success');
                }
            });
        });
    }

    function renderTemplateSelect() {
        const templates = getTemplates().filter(t => t.isActive);
        const select = document.getElementById('templateSelect');

        select.innerHTML = '<option value="">-- Choose from saved templates --</option>' +
            templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    function renderEntriesList() {
        const entries = getEntries();
        const stats = getEntriesStats();
        const container = document.getElementById('entriesList');
        const noEntries = document.getElementById('noEntries');
        const statsContainer = document.getElementById('entriesStats');

        // Render stats
        if (statsContainer) {
            const currencyStats = Object.entries(stats.byCurrency)
                .map(([currency, amount]) => `${CURRENCY_SYMBOLS[currency] || currency}${amount.toFixed(2)}`)
                .join(' | ');
            
            statsContainer.innerHTML = `
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="stat-card stat-primary">
                            <div class="stat-icon"><i class="fas fa-file-invoice"></i></div>
                            <div class="stat-content">
                                <div class="stat-value">${stats.totalEntries}</div>
                                <div class="stat-label">Total Receipts</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="stat-card stat-success">
                            <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
                            <div class="stat-content">
                                <div class="stat-value">${currencyStats || '₹0.00'}</div>
                                <div class="stat-label">Total Amount</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="stat-card stat-info">
                            <div class="stat-icon"><i class="fas fa-calculator"></i></div>
                            <div class="stat-content">
                                <div class="stat-value">${stats.totalEntries > 0 ? (stats.totalAmount / stats.totalEntries).toFixed(2) : '0.00'}</div>
                                <div class="stat-label">Average Amount</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (entries.length === 0) {
            container.innerHTML = '';
            noEntries.classList.remove('hidden');
            return;
        }

        noEntries.classList.add('hidden');
        container.innerHTML = entries.map(entry => `
            <div class="entry-card" data-id="${entry.id}">
                <div class="entry-main">
                    <div class="entry-info">
                        <div class="entry-header">
                            <span class="entry-number">${entry.receiptNumber}</span>
                            <span class="entry-date">${formatDateTime(entry.createdAt)}</span>
                        </div>
                        <div class="entry-details">
                            <div class="entry-payer">
                                <i class="fas fa-user me-2 text-muted"></i>
                                <strong>${entry.payerName}</strong>
                            </div>
                            <div class="entry-template">
                                <i class="fas fa-image me-2 text-muted"></i>
                                ${entry.templateName || 'Custom Template'}
                            </div>
                        </div>
                    </div>
                    <div class="entry-amount">
                        <span class="amount-value">${entry.formattedAmount}</span>
                    </div>
                </div>
                <div class="entry-actions">
                    <button class="btn btn-sm btn-outline-danger delete-entry" data-id="${entry.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        document.querySelectorAll('.delete-entry').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this entry?')) {
                    deleteEntry(btn.dataset.id);
                    renderEntriesList();
                    showToast('Entry deleted successfully', 'success');
                }
            });
        });
    }

    // ========================================
    // Event Handlers
    // ========================================

    // Login Form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        const isValid = await verifyPassword(password);
        if (isValid) {
            createSession();
            showApp();
            renderTemplatesList();
            renderTemplateSelect();
            renderEntriesList();
            showToast('Login successful!', 'success');
        } else {
            errorEl.textContent = 'Invalid password. Please try again.';
        }
    });

    // Logout Button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        destroySession();
        showLogin();
        showToast('Logged out successfully', 'info');
    });

    // Password Form
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 4) {
            showToast('Password must be at least 4 characters', 'error');
            return;
        }

        await updatePassword(newPassword);
        document.getElementById('passwordForm').reset();
        showToast('Password updated successfully', 'success');
    });

    // Template Form
    document.getElementById('templateForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('templateName').value;
        const file = document.getElementById('templateFile').files[0];

        if (!file) {
            showToast('Please select an image file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            addTemplate(name, reader.result);
            document.getElementById('templateForm').reset();
            document.getElementById('templatePreviewContainer').classList.add('hidden');
            renderTemplatesList();
            renderTemplateSelect();
            showToast('Template added successfully', 'success');
        };
        reader.readAsDataURL(file);
    });

    // Template File Preview
    document.getElementById('templateFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                document.getElementById('templatePreviewImg').src = reader.result;
                document.getElementById('templatePreviewContainer').classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // Custom Template Upload
    let customTemplateData = null;

    document.getElementById('customTemplate').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                customTemplateData = reader.result;
                document.getElementById('customPreviewImg').src = customTemplateData;
                document.getElementById('customTemplatePreview').classList.remove('hidden');
                document.getElementById('templateSelect').value = '';
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('clearCustomTemplate').addEventListener('click', () => {
        customTemplateData = null;
        document.getElementById('customTemplate').value = '';
        document.getElementById('customTemplatePreview').classList.add('hidden');
    });

    document.getElementById('templateSelect').addEventListener('change', () => {
        if (document.getElementById('templateSelect').value) {
            customTemplateData = null;
            document.getElementById('customTemplate').value = '';
            document.getElementById('customTemplatePreview').classList.add('hidden');
        }
    });

    // Receipt Form
    document.getElementById('receiptForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const templateId = document.getElementById('templateSelect').value;
        const payerName = document.getElementById('payerName').value;
        const amountPaid = document.getElementById('amountPaid').value;
        const currency = document.getElementById('currency').value;

        if (!templateId && !customTemplateData) {
            showToast('Please select a template or upload a custom one', 'error');
            return;
        }

        // Get template image and name
        let templateImage = customTemplateData;
        let templateName = 'Custom Template';
        if (templateId) {
            const templates = getTemplates();
            const template = templates.find(t => t.id === templateId);
            if (template) {
                templateImage = template.imageData;
                templateName = template.name;
            }
        }

        // Prepare receipt data
        const receiptData = {
            receiptNumber: generateReceiptNumber(),
            date: formatDate(),
            payerName,
            amount: amountPaid,
            currency,
            formattedAmount: formatAmount(amountPaid, currency),
            templateId: templateId || null,
            templateName,
        };

        // Generate receipt
        await drawReceipt(templateImage, receiptData);

        // Save entry
        addEntry(receiptData);

        // Show preview
        document.getElementById('placeholderText').classList.add('hidden');
        document.getElementById('receiptCanvas').classList.remove('hidden');
        document.getElementById('downloadBtn').classList.remove('hidden');

        // Refresh entries list if on admin tab
        renderEntriesList();

        showToast('Receipt generated successfully!', 'success');
    });

    // Download Button
    document.getElementById('downloadBtn').addEventListener('click', () => {
        const canvas = document.getElementById('receiptCanvas');
        const link = document.createElement('a');
        link.download = `receipt-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Receipt downloaded!', 'success');
    });

    // Clear All Entries Button
    const clearAllBtn = document.getElementById('clearAllEntries');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear ALL receipt entries? This cannot be undone.')) {
                clearAllEntries();
                renderEntriesList();
                showToast('All entries cleared', 'success');
            }
        });
    }

    // ========================================
    // Initialization
    // ========================================

    async function init() {
        // Initialize password
        await initializePassword();

        // Check session
        if (verifySession()) {
            showApp();
            renderTemplatesList();
            renderTemplateSelect();
            renderEntriesList();
        } else {
            showLogin();
        }
    }

    // Run initialization
    init();

})();