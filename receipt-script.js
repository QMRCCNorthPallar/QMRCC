/**
 * QMRCC Receipt Generator Pro
 * Client-side application using localStorage
 * 
 * Features:
 * - Template management with serial prefixes
 * - Unique receipt numbers per template
 * - Receipt history tracking
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
        SETTINGS_KEY: 'qmrcc_settings',
        DEFAULT_PASSWORD: 'admin123',
        SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
        ORG_PREFIX: 'QMRCC', // Organization prefix for receipts
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

    // Pad number with zeros
    function padNumber(num, length = 4) {
        return String(num).padStart(length, '0');
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
    // Settings Functions
    // ========================================

    function getSettings() {
        return getFromStorage(CONFIG.SETTINGS_KEY) || {
            orgPrefix: CONFIG.ORG_PREFIX,
            nextTemplateSerial: 1,
        };
    }

    function saveSettings(settings) {
        return saveToStorage(CONFIG.SETTINGS_KEY, settings);
    }

    function getNextTemplateSerial() {
        const settings = getSettings();
        const serial = settings.nextTemplateSerial;
        settings.nextTemplateSerial += 1;
        saveSettings(settings);
        return serial;
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

    function generateTemplateSerial() {
        const serialNum = getNextTemplateSerial();
        return `${CONFIG.ORG_PREFIX}-${padNumber(serialNum, 3)}`;
    }

    function addTemplate(name, imageData, mimeType = 'image/png') {
        const templates = getTemplates();
        const serial = generateTemplateSerial();
        const newTemplate = {
            id: generateToken(),
            name,
            serial, // Unique serial like "QMRCC-001"
            imageData,
            mimeType,
            isActive: true,
            usageCount: 0,
            receiptCounter: 0, // Counter for receipts generated with this template
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
        if (!templateId) return null;
        const templates = getTemplates();
        const index = templates.findIndex(t => t.id === templateId);
        if (index !== -1) {
            templates[index].usageCount = (templates[index].usageCount || 0) + 1;
            templates[index].receiptCounter = (templates[index].receiptCounter || 0) + 1;
            saveTemplates(templates);
            return templates[index];
        }
        return null;
    }

    function getTemplateById(id) {
        const templates = getTemplates();
        return templates.find(t => t.id === id);
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
            refId: data.refId,
            donorName: data.donorName,
            amount: data.amount,
            currency: data.currency,
            formattedAmount: data.formattedAmount,
            date: data.date,
            time: data.time,
            templateId: data.templateId,
            templateName: data.templateName,
            templateSerial: data.templateSerial,
            createdAt: new Date().toISOString(),
        };
        entries.unshift(newEntry); // Add to beginning
        saveEntries(entries);
        
        // Increment template usage and counter
        const updatedTemplate = incrementTemplateUsage(data.templateId);
        
        return { entry: newEntry, template: updatedTemplate };
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
        
        // Get entries by template
        const byTemplate = entries.reduce((acc, entry) => {
            const key = entry.templateSerial || 'CUSTOM';
            if (!acc[key]) {
                acc[key] = { count: 0, total: 0, name: entry.templateName || 'Custom Template' };
            }
            acc[key].count += 1;
            acc[key].total += parseFloat(entry.amount || 0);
            return acc;
        }, {});
        
        return { totalEntries, totalAmount, byCurrency, byTemplate };
    }

    // ========================================
    // Receipt Generation
    // ========================================

    function generateReceiptNumber(template) {
        // Get current date and time components
        const now = new Date();
        const year = String(now.getFullYear()).slice(2); // Last 2 digits
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        // Format: YYMMDDHHMMSS (e.g., 250316154530)
        const dateTimeStr = `${year}${month}${day}${hours}${minutes}${seconds}`;
        
        if (template && template.serial) {
            // Use template's serial + date/time + counter for uniqueness
            const counter = (template.receiptCounter || 0) + 1;
            // Format: QMRCC-001-250316154530-0001
            return `${template.serial}-${dateTimeStr}-${padNumber(counter, 4)}`;
        } else {
            // For custom templates, use timestamp-based number
            // Format: CUSTOM-250316154530
            return `CUSTOM-${dateTimeStr}`;
        }
    }

    function formatDateTimeForDisplay(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    function formatDate() {
        return new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    function formatTime() {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
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
                ctx.textAlign = 'left';

                // Font size
                const fontSize = 16;
                ctx.font = `${fontSize}px 'Rubik', Arial, sans-serif`;

                // Draw fields at exact coordinates
                // Ref ID: x=210, y=215
                ctx.fillText(data.refId || data.receiptNumber, 136.16, 136.58);

                // Date: x=1050, y=215
                ctx.fillText(data.date, 617.88, 136.12);

                // Donor Name: x=450, y=365
                ctx.fillText(data.donorName, 266.67, 219.99);

                // Amount in Figures: x=450, y=410
                ctx.fillText(data.formattedAmount, 265.93, 239.63);

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
                    <div class="template-serial-badge">${template.serial}</div>
                    <img src="${template.imageData}" alt="${template.name}">
                    <div class="template-name">${template.name}</div>
                    <div class="template-meta">
                        <span class="badge ${template.isActive ? 'bg-success' : 'bg-secondary'}">
                            ${template.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span class="badge bg-info">
                            <i class="fas fa-file-invoice me-1"></i>${template.receiptCounter || 0} receipts
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
                if (confirm('Are you sure you want to delete this template? All receipt history for this template will be preserved.')) {
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
            templates.map(t => `<option value="${t.id}">[${t.serial}] ${t.name}</option>`).join('');
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
            
            // Template stats
            const templateStatsHtml = Object.entries(stats.byTemplate)
                .slice(0, 3)
                .map(([serial, data]) => `
                    <div class="template-stat-item">
                        <span class="template-stat-serial">${serial}</span>
                        <span class="template-stat-count">${data.count} receipts</span>
                    </div>
                `).join('');
            
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
                ${Object.keys(stats.byTemplate).length > 0 ? `
                <div class="template-stats-summary mt-3">
                    <h6 class="text-muted mb-2"><i class="fas fa-chart-pie me-1"></i>By Template:</h6>
                    <div class="template-stats-row">
                        ${templateStatsHtml}
                    </div>
                </div>
                ` : ''}
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
                            <span class="entry-number">${entry.refId || entry.receiptNumber}</span>
                            <span class="entry-date"><i class="fas fa-calendar-alt me-1"></i>${entry.date || ''} <i class="fas fa-clock ms-2 me-1"></i>${entry.time || ''}</span>
                        </div>
                        <div class="entry-details">
                            <div class="entry-payer">
                                <i class="fas fa-user me-2 text-muted"></i>
                                <strong>${entry.donorName || 'N/A'}</strong>
                            </div>
                            <div class="entry-template">
                                <i class="fas fa-image me-2 text-muted"></i>
                                <span class="template-serial-small">${entry.templateSerial || 'CUSTOM'}</span> ${entry.templateName || 'Custom Template'}
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
            const newTemplate = addTemplate(name, reader.result);
            document.getElementById('templateForm').reset();
            document.getElementById('templatePreviewContainer').classList.add('hidden');
            renderTemplatesList();
            renderTemplateSelect();
            showToast(`Template "${name}" added with serial: ${newTemplate.serial}`, 'success');
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
        const donorName = document.getElementById('donorName').value;
        const amountPaid = document.getElementById('amountPaid').value;
        const currency = document.getElementById('currency').value;
        const refId = document.getElementById('refId').value;

        if (!templateId && !customTemplateData) {
            showToast('Please select a template or upload a custom one', 'error');
            return;
        }

        // Get template image and details
        let templateImage = customTemplateData;
        let templateName = 'Custom Template';
        let templateSerial = null;
        let template = null;

        if (templateId) {
            template = getTemplateById(templateId);
            if (template) {
                templateImage = template.imageData;
                templateName = template.name;
                templateSerial = template.serial;
            }
        }

        // Generate receipt number based on template
        const receiptNumber = generateReceiptNumber(template);

        // Prepare receipt data
        const receiptData = {
            receiptNumber,
            refId: refId || receiptNumber, // Use provided Ref ID or receipt number
            date: formatDate(),
            time: formatTime(),
            donorName,
            amount: amountPaid,
            currency,
            formattedAmount: formatAmount(amountPaid, currency),
            templateId: templateId || null,
            templateName,
            templateSerial,
        };

        // Generate receipt
        await drawReceipt(templateImage, receiptData);

        // Save entry and increment counters
        addEntry(receiptData);

        // Show preview
        document.getElementById('placeholderText').classList.add('hidden');
        document.getElementById('receiptCanvas').classList.remove('hidden');
        document.getElementById('downloadBtn').classList.remove('hidden');

        // Refresh lists
        renderEntriesList();
        renderTemplatesList();

        showToast(`Receipt generated: ${receiptNumber}`, 'success');
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

        // Initialize settings if not exists
        if (!getFromStorage(CONFIG.SETTINGS_KEY)) {
            saveSettings({
                orgPrefix: CONFIG.ORG_PREFIX,
                nextTemplateSerial: 1,
            });
        }

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