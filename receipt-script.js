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
        TEXT_SETTINGS_KEY: 'qmrcc_text_settings', // Separate key for text settings
        GITHUB_CONFIG_KEY: 'qmrcc_github_config', // GitHub API configuration
        GITHUB_DATA_KEY: 'qmrcc_github_data', // Cached GitHub data
        DEFAULT_PASSWORD: 'admin123',
        SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
        ORG_PREFIX: 'QMRCC', // Organization prefix for receipts
        GITHUB_API: 'https://api.github.com',
        GITHUB_DATA_FILE: 'data/qmrcc-data.json', // File path in repo for data storage
    };

    // Default text settings - Updated per user requirements
    const DEFAULT_TEXT_SETTINGS = {
        refId: { show: true, x: 290, y: 260, fontSize: 30 },
        date: { show: true, x: 1290, y: 260, fontSize: 30 },
        donorName: { show: true, x: 560, y: 420, fontSize: 35 },
        amount: { show: true, x: 560, y: 480, fontSize: 35 },
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
    // GitHub API Functions
    // ========================================

    function getGitHubConfig() {
        return getFromStorage(CONFIG.GITHUB_CONFIG_KEY) || {
            enabled: false,
            token: '',
            owner: '',
            repo: '',
            branch: 'main',
            lastSync: null,
        };
    }

    function saveGitHubConfig(config) {
        return saveToStorage(CONFIG.GITHUB_CONFIG_KEY, config);
    }

    function isGitHubEnabled() {
        const config = getGitHubConfig();
        return config.enabled && config.token && config.owner && config.repo;
    }

    // GitHub API request wrapper
    async function githubRequest(endpoint, method = 'GET', data = null) {
        const config = getGitHubConfig();
        if (!config.token) {
            throw new Error('GitHub token not configured');
        }

        const options = {
            method,
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.GITHUB_API}${endpoint}`;
        const response = await fetch(url, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `GitHub API error: ${response.status}`);
        }

        return response.json();
    }

    // Get file from GitHub
    async function getGitHubFile(path) {
        const config = getGitHubConfig();
        const endpoint = `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
        
        try {
            const result = await githubRequest(endpoint);
            return {
                sha: result.sha,
                content: JSON.parse(atob(result.content)),
                exists: true,
            };
        } catch (error) {
            if (error.message.includes('404')) {
                return { sha: null, content: null, exists: false };
            }
            throw error;
        }
    }

    // Save file to GitHub
    async function saveGitHubFile(path, content, message = 'Update data', sha = null) {
        const config = getGitHubConfig();
        const endpoint = `/repos/${config.owner}/${config.repo}/contents/${path}`;
        
        const data = {
            message,
            branch: config.branch,
            content: btoa(JSON.stringify(content, null, 2)),
        };

        if (sha) {
            data.sha = sha;
        }

        return githubRequest(endpoint, 'PUT', data);
    }

    // Sync all data to GitHub
    async function syncToGitHub() {
        if (!isGitHubEnabled()) {
            return { success: false, message: 'GitHub sync not enabled' };
        }

        try {
            const config = getGitHubConfig();
            
            // Prepare data to sync (exclude sensitive/local-only data)
            const dataToSync = {
                version: '1.0',
                syncedAt: new Date().toISOString(),
                settings: getSettings(),
                textSettings: getTextSettings(),
                templates: getTemplates().map(t => {
                    // For default template, don't include base64 image data
                    if (t.isDefault) {
                        const { imageData, ...rest } = t;
                        return rest;
                    }
                    return t;
                }),
                entries: getEntries(),
            };

            // Get existing file to get SHA
            const existingFile = await getGitHubFile(CONFIG.GITHUB_DATA_FILE);
            
            // Save to GitHub
            await saveGitHubFile(
                CONFIG.GITHUB_DATA_FILE,
                dataToSync,
                `Update QMRCC data - ${new Date().toISOString()}`,
                existingFile.sha
            );

            // Update last sync time
            config.lastSync = new Date().toISOString();
            saveGitHubConfig(config);

            return { success: true, message: 'Data synced to GitHub successfully' };
        } catch (error) {
            console.error('GitHub sync error:', error);
            return { success: false, message: error.message };
        }
    }

    // Sync data from GitHub
    async function syncFromGitHub() {
        if (!isGitHubEnabled()) {
            return { success: false, message: 'GitHub sync not enabled' };
        }

        try {
            const file = await getGitHubFile(CONFIG.GITHUB_DATA_FILE);
            
            if (!file.exists || !file.content) {
                return { success: false, message: 'No data found on GitHub' };
            }

            const data = file.content;

            // Merge GitHub data with local data
            if (data.settings) {
                const localSettings = getSettings();
                // Use the higher receipt counter to avoid duplicates
                if (data.settings.receiptCounter > localSettings.receiptCounter) {
                    localSettings.receiptCounter = data.settings.receiptCounter;
                }
                if (data.settings.nextTemplateSerial > localSettings.nextTemplateSerial) {
                    localSettings.nextTemplateSerial = data.settings.nextTemplateSerial;
                }
                saveSettings(localSettings);
            }

            if (data.textSettings) {
                saveTextSettings(data.textSettings);
            }

            if (data.templates && Array.isArray(data.templates)) {
                const localTemplates = getTemplates();
                const localIds = new Set(localTemplates.map(t => t.id));
                
                // Add templates that don't exist locally
                const newTemplates = data.templates.filter(t => !localIds.has(t.id));
                
                // Update existing templates with higher usage counts
                data.templates.forEach(gt => {
                    const localIdx = localTemplates.findIndex(t => t.id === gt.id);
                    if (localIdx !== -1 && gt.receiptCounter > localTemplates[localIdx].receiptCounter) {
                        localTemplates[localIdx].receiptCounter = gt.receiptCounter;
                        localTemplates[localIdx].usageCount = gt.usageCount;
                    }
                });
                
                if (newTemplates.length > 0) {
                    saveTemplates([...localTemplates, ...newTemplates]);
                } else {
                    saveTemplates(localTemplates);
                }
            }

            if (data.entries && Array.isArray(data.entries)) {
                const localEntries = getEntries();
                const localIds = new Set(localEntries.map(e => e.id));
                
                // Add entries that don't exist locally
                const newEntries = data.entries.filter(e => !localIds.has(e.id));
                
                if (newEntries.length > 0) {
                    // Sort by date, newest first
                    const allEntries = [...newEntries, ...localEntries];
                    allEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    saveEntries(allEntries);
                }
            }

            // Update last sync time
            const config = getGitHubConfig();
            config.lastSync = new Date().toISOString();
            saveGitHubConfig(config);

            return { success: true, message: 'Data synced from GitHub successfully' };
        } catch (error) {
            console.error('GitHub sync error:', error);
            return { success: false, message: error.message };
        }
    }

    // Auto-sync to GitHub (debounced)
    let syncTimeout = null;
    function autoSyncToGitHub() {
        if (!isGitHubEnabled()) return;
        
        // Debounce - wait 3 seconds before syncing
        if (syncTimeout) {
            clearTimeout(syncTimeout);
        }
        
        syncTimeout = setTimeout(async () => {
            const result = await syncToGitHub();
            if (result.success) {
                console.log('Auto-synced to GitHub');
                updateSyncStatus('synced');
            } else {
                console.error('Auto-sync failed:', result.message);
            }
        }, 3000);
    }

    // Update sync status indicator
    function updateSyncStatus(status) {
        const statusEl = document.getElementById('syncStatus');
        if (!statusEl) return;

        const config = getGitHubConfig();
        
        if (!config.enabled) {
            statusEl.innerHTML = '<i class="fas fa-database text-secondary"></i> Local Storage';
            return;
        }

        switch (status) {
            case 'syncing':
                statusEl.innerHTML = '<i class="fas fa-sync fa-spin text-warning"></i> Syncing...';
                break;
            case 'synced':
                statusEl.innerHTML = '<i class="fas fa-cloud text-success"></i> Synced to GitHub';
                break;
            case 'error':
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle text-danger"></i> Sync Error';
                break;
            default:
                if (config.lastSync) {
                    const lastSync = new Date(config.lastSync);
                    const timeAgo = getTimeAgo(lastSync);
                    statusEl.innerHTML = `<i class="fas fa-cloud text-success"></i> Last sync: ${timeAgo}`;
                } else {
                    statusEl.innerHTML = '<i class="fas fa-cloud text-muted"></i> GitHub Enabled';
                }
        }
    }

    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    // Test GitHub connection
    async function testGitHubConnection() {
        const config = getGitHubConfig();
        
        if (!config.token || !config.owner || !config.repo) {
            return { success: false, message: 'Please fill in all GitHub fields' };
        }

        try {
            // Test by getting repo info
            const result = await githubRequest(`/repos/${config.owner}/${config.repo}`);
            return { 
                success: true, 
                message: `Connected to ${result.full_name} (${result.private ? 'private' : 'public'})` 
            };
        } catch (error) {
            return { success: false, message: error.message };
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
    // Text Settings Functions
    // ========================================

    function getTextSettings() {
        const saved = getFromStorage(CONFIG.TEXT_SETTINGS_KEY);
        if (saved && typeof saved === 'object') {
            // Merge with defaults to ensure all fields exist
            return {
                refId: { ...DEFAULT_TEXT_SETTINGS.refId, ...saved.refId },
                date: { ...DEFAULT_TEXT_SETTINGS.date, ...saved.date },
                donorName: { ...DEFAULT_TEXT_SETTINGS.donorName, ...saved.donorName },
                amount: { ...DEFAULT_TEXT_SETTINGS.amount, ...saved.amount },
            };
        }
        return { ...DEFAULT_TEXT_SETTINGS };
    }

    function saveTextSettings(settings) {
        const result = saveToStorage(CONFIG.TEXT_SETTINGS_KEY, settings);
        autoSyncToGitHub(); // Sync to GitHub
        return result;
    }

    function resetTextSettings() {
        const result = saveToStorage(CONFIG.TEXT_SETTINGS_KEY, { ...DEFAULT_TEXT_SETTINGS });
        autoSyncToGitHub(); // Sync to GitHub
        return result;
    }

    // Populate text settings form
    function loadTextSettingsForm() {
        const settings = getTextSettings();
        
        // Ref ID
        document.getElementById('showRefId').checked = settings.refId.show;
        document.getElementById('refIdX').value = settings.refId.x;
        document.getElementById('refIdY').value = settings.refId.y;
        document.getElementById('refIdFontSize').value = settings.refId.fontSize;
        
        // Date
        document.getElementById('showDate').checked = settings.date.show;
        document.getElementById('dateX').value = settings.date.x;
        document.getElementById('dateY').value = settings.date.y;
        document.getElementById('dateFontSize').value = settings.date.fontSize;
        
        // Donor Name
        document.getElementById('showDonorName').checked = settings.donorName.show;
        document.getElementById('donorNameX').value = settings.donorName.x;
        document.getElementById('donorNameY').value = settings.donorName.y;
        document.getElementById('donorNameFontSize').value = settings.donorName.fontSize;
        
        // Amount
        document.getElementById('showAmount').checked = settings.amount.show;
        document.getElementById('amountX').value = settings.amount.x;
        document.getElementById('amountY').value = settings.amount.y;
        document.getElementById('amountFontSize').value = settings.amount.fontSize;
    }

    // Get text settings from form
    function getTextSettingsFromForm() {
        return {
            refId: {
                show: document.getElementById('showRefId').checked,
                x: parseInt(document.getElementById('refIdX').value) || DEFAULT_TEXT_SETTINGS.refId.x,
                y: parseInt(document.getElementById('refIdY').value) || DEFAULT_TEXT_SETTINGS.refId.y,
                fontSize: parseInt(document.getElementById('refIdFontSize').value) || DEFAULT_TEXT_SETTINGS.refId.fontSize,
            },
            date: {
                show: document.getElementById('showDate').checked,
                x: parseInt(document.getElementById('dateX').value) || DEFAULT_TEXT_SETTINGS.date.x,
                y: parseInt(document.getElementById('dateY').value) || DEFAULT_TEXT_SETTINGS.date.y,
                fontSize: parseInt(document.getElementById('dateFontSize').value) || DEFAULT_TEXT_SETTINGS.date.fontSize,
            },
            donorName: {
                show: document.getElementById('showDonorName').checked,
                x: parseInt(document.getElementById('donorNameX').value) || DEFAULT_TEXT_SETTINGS.donorName.x,
                y: parseInt(document.getElementById('donorNameY').value) || DEFAULT_TEXT_SETTINGS.donorName.y,
                fontSize: parseInt(document.getElementById('donorNameFontSize').value) || DEFAULT_TEXT_SETTINGS.donorName.fontSize,
            },
            amount: {
                show: document.getElementById('showAmount').checked,
                x: parseInt(document.getElementById('amountX').value) || DEFAULT_TEXT_SETTINGS.amount.x,
                y: parseInt(document.getElementById('amountY').value) || DEFAULT_TEXT_SETTINGS.amount.y,
                fontSize: parseInt(document.getElementById('amountFontSize').value) || DEFAULT_TEXT_SETTINGS.amount.fontSize,
            },
        };
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
        autoSyncToGitHub(); // Sync to GitHub
        return newTemplate;
    }

    function updateTemplate(id, updates) {
        const templates = getTemplates();
        const index = templates.findIndex(t => t.id === id);
        if (index !== -1) {
            templates[index] = { ...templates[index], ...updates, updatedAt: new Date().toISOString() };
            saveTemplates(templates);
            autoSyncToGitHub(); // Sync to GitHub
            return templates[index];
        }
        return null;
    }

    function deleteTemplate(id) {
        const templates = getTemplates();
        const filtered = templates.filter(t => t.id !== id);
        const result = saveTemplates(filtered);
        autoSyncToGitHub(); // Sync to GitHub
        return result;
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
        
        autoSyncToGitHub(); // Sync to GitHub
        
        return { entry: newEntry, template: updatedTemplate };
    }

    function deleteEntry(id) {
        const entries = getEntries();
        const filtered = entries.filter(e => e.id !== id);
        const result = saveEntries(filtered);
        autoSyncToGitHub(); // Sync to GitHub
        return result;
    }

    function clearAllEntries() {
        const result = saveToStorage(CONFIG.ENTRIES_KEY, []);
        autoSyncToGitHub(); // Sync to GitHub
        return result;
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

    function getNextReceiptNumber() {
        const settings = getSettings();
        const counter = (settings.receiptCounter || 0) + 1;
        settings.receiptCounter = counter;
        saveSettings(settings);
        return `${CONFIG.ORG_PREFIX}-${padNumber(counter, 3)}`;
    }

    function generateReceiptNumber(template) {
        // Simple sequential format: QMRCC-001, QMRCC-002, etc.
        return getNextReceiptNumber();
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
        const settings = getTextSettings();

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

                // Draw Ref ID
                if (settings.refId.show) {
                    ctx.font = `${settings.refId.fontSize}px 'Rubik', Arial, sans-serif`;
                    ctx.fillText(data.refId || data.receiptNumber, settings.refId.x, settings.refId.y);
                }

                // Draw Date
                if (settings.date.show) {
                    ctx.font = `${settings.date.fontSize}px 'Rubik', Arial, sans-serif`;
                    ctx.fillText(data.date, settings.date.x, settings.date.y);
                }

                // Draw Donor Name
                if (settings.donorName.show) {
                    ctx.font = `${settings.donorName.fontSize}px 'Rubik', Arial, sans-serif`;
                    ctx.fillText(data.donorName, settings.donorName.x, settings.donorName.y);
                }

                // Draw Amount
                if (settings.amount.show) {
                    ctx.font = `${settings.amount.fontSize}px 'Rubik', Arial, sans-serif`;
                    ctx.fillText(data.formattedAmount, settings.amount.x, settings.amount.y);
                }

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
                    <img src="${template.imageData}" alt="${template.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect fill=%22%23f0f0f0%22 width=%22200%22 height=%22150%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22>Image not found</text></svg>'">
                    <div class="template-name">${template.name}</div>
                    <div class="template-meta">
                        <span class="badge ${template.isActive ? 'bg-success' : 'bg-secondary'}">
                            ${template.isActive ? 'Active' : 'Inactive'}
                        </span>
                        ${template.isDefault ? '<span class="badge bg-secondary">Default</span>' : ''}
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
                        <button class="btn btn-outline-danger btn-sm delete-template" data-id="${template.id}" ${template.isDefault ? 'title="Default template - can be deleted after adding new templates"' : ''}>
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

    // Save Text Settings Button
    const saveTextSettingsBtn = document.getElementById('saveTextSettings');
    if (saveTextSettingsBtn) {
        saveTextSettingsBtn.addEventListener('click', () => {
            const settings = getTextSettingsFromForm();
            saveTextSettings(settings);
            showToast('Text settings saved successfully!', 'success');
        });
    }

    // Reset Text Settings Button
    const resetTextSettingsBtn = document.getElementById('resetTextSettings');
    if (resetTextSettingsBtn) {
        resetTextSettingsBtn.addEventListener('click', () => {
            if (confirm('Reset all text settings to default values?')) {
                resetTextSettings();
                loadTextSettingsForm();
                showToast('Text settings reset to defaults', 'success');
            }
        });
    }

    // Load text settings when admin tab is shown
    const adminTab = document.getElementById('admin-tab');
    if (adminTab) {
        adminTab.addEventListener('shown.bs.tab', () => {
            loadTextSettingsForm();
            loadGitHubSettingsForm();
            updateSyncStatus();
        });
    }

    // ========================================
    // GitHub Settings Event Handlers
    // ========================================

    // Test GitHub Connection Button
    const testGitHubBtn = document.getElementById('testGitHubConnection');
    if (testGitHubBtn) {
        testGitHubBtn.addEventListener('click', async () => {
            const config = {
                token: document.getElementById('githubToken')?.value || '',
                owner: document.getElementById('githubOwner')?.value || '',
                repo: document.getElementById('githubRepo')?.value || '',
            };
            
            // Temporarily save to test
            const currentConfig = getGitHubConfig();
            saveGitHubConfig({ ...currentConfig, ...config });
            
            const result = await testGitHubConnection();
            
            if (result.success) {
                showToast(`✅ ${result.message}`, 'success');
            } else {
                showToast(`❌ ${result.message}`, 'error');
            }
        });
    }

    // Save GitHub Settings Button
    const saveGitHubBtn = document.getElementById('saveGitHubSettings');
    if (saveGitHubBtn) {
        saveGitHubBtn.addEventListener('click', async () => {
            const config = {
                enabled: document.getElementById('githubEnabled')?.checked || false,
                token: document.getElementById('githubToken')?.value || '',
                owner: document.getElementById('githubOwner')?.value || '',
                repo: document.getElementById('githubRepo')?.value || '',
                branch: document.getElementById('githubBranch')?.value || 'main',
            };
            
            saveGitHubConfig(config);
            updateSyncStatus();
            
            // If enabling, do an initial sync
            if (config.enabled && config.token && config.owner && config.repo) {
                showToast('Testing connection and syncing...', 'info');
                const testResult = await testGitHubConnection();
                
                if (testResult.success) {
                    // First sync from GitHub
                    await syncFromGitHub();
                    // Then sync to GitHub
                    await syncToGitHub();
                    
                    renderTemplatesList();
                    renderTemplateSelect();
                    renderEntriesList();
                    loadTextSettingsForm();
                    
                    showToast('✅ GitHub sync enabled and synced!', 'success');
                } else {
                    showToast(`❌ Connection failed: ${testResult.message}`, 'error');
                }
            } else {
                showToast('GitHub settings saved', 'success');
            }
        });
    }

    // Manual Sync Now Button
    const syncNowBtn = document.getElementById('syncNow');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', async () => {
            if (!isGitHubEnabled()) {
                showToast('Please configure and enable GitHub sync first', 'error');
                return;
            }
            
            updateSyncStatus('syncing');
            showToast('Syncing with GitHub...', 'info');
            
            // First pull from GitHub
            const pullResult = await syncFromGitHub();
            // Then push to GitHub
            const pushResult = await syncToGitHub();
            
            if (pushResult.success) {
                renderTemplatesList();
                renderTemplateSelect();
                renderEntriesList();
                loadTextSettingsForm();
                updateSyncStatus('synced');
                showToast('✅ Synced with GitHub!', 'success');
            } else {
                updateSyncStatus('error');
                showToast(`❌ Sync failed: ${pushResult.message}`, 'error');
            }
        });
    }

    // ========================================
    // Export/Import Functions
    // ========================================

    function exportAllData() {
        const allTemplates = getTemplates();
        // Filter out default templates (they're built-in, no need to export)
        const customTemplates = allTemplates.filter(t => !t.isDefault);
        
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            templates: customTemplates,
            textSettings: getTextSettings(),
            settings: getSettings(),
            // Note: entries and password are NOT exported for privacy/security
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qmrcc-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        return data;
    }

    function importAllData(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            if (!data.version) {
                throw new Error('Invalid backup file format');
            }
            
            // Import templates
            if (data.templates && Array.isArray(data.templates)) {
                const existingTemplates = getTemplates();
                const existingIds = new Set(existingTemplates.map(t => t.id));
                const newTemplates = data.templates.filter(t => !existingIds.has(t.id));
                
                if (newTemplates.length > 0) {
                    saveTemplates([...existingTemplates, ...newTemplates]);
                }
            }
            
            // Import text settings
            if (data.textSettings) {
                saveTextSettings(data.textSettings);
            }
            
            // Import settings (template serial counter)
            if (data.settings) {
                const currentSettings = getSettings();
                // Keep the higher serial number to avoid duplicates
                if (data.settings.nextTemplateSerial > currentSettings.nextTemplateSerial) {
                    currentSettings.nextTemplateSerial = data.settings.nextTemplateSerial;
                    saveSettings(currentSettings);
                }
            }
            
            return { success: true, templatesImported: data.templates?.length || 0 };
        } catch (error) {
            console.error('Import error:', error);
            return { success: false, error: error.message };
        }
    }

    // Export Button
    const exportDataBtn = document.getElementById('exportData');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            exportAllData();
            showToast('Data exported successfully!', 'success');
        });
    }

    // Import Button
    const importDataBtn = document.getElementById('importData');
    const importFileInput = document.getElementById('importFile');
    
    if (importDataBtn && importFileInput) {
        importDataBtn.addEventListener('click', () => {
            importFileInput.click();
        });
        
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = importAllData(event.target.result);
                if (result.success) {
                    renderTemplatesList();
                    renderTemplateSelect();
                    loadTextSettingsForm();
                    showToast(`Imported ${result.templatesImported} templates and settings!`, 'success');
                } else {
                    showToast(`Import failed: ${result.error}`, 'error');
                }
            };
            reader.readAsText(file);
            
            // Reset file input
            importFileInput.value = '';
        });
    }

    // ========================================
    // Default Template Functions
    // ========================================

    async function initializeDefaultTemplate() {
        const templates = getTemplates();
        
        // Only add default template if no templates exist
        if (templates.length === 0) {
            try {
                // Load default template image
                const defaultTemplate = {
                    id: 'default-template-' + generateToken(),
                    name: 'Default Receipt Template',
                    serial: 'QMRCC-001',
                    imageData: 'images/receipt.png', // Path to default template
                    mimeType: 'image/png',
                    isActive: true,
                    usageCount: 0,
                    receiptCounter: 0,
                    createdAt: new Date().toISOString(),
                    isDefault: true, // Flag to identify default template
                };
                
                templates.push(defaultTemplate);
                saveTemplates(templates);
                
                // Update settings to start template serial from 002
                const settings = getSettings();
                settings.nextTemplateSerial = 2;
                saveSettings(settings);
                
                console.log('Default template initialized');
            } catch (error) {
                console.error('Failed to initialize default template:', error);
            }
        }
    }

    // ========================================
    // Initialization
    // ========================================

    async function init() {
        // Initialize password
        await initializePassword();

        // Initialize text settings if not exists (separate from general settings)
        if (!getFromStorage(CONFIG.TEXT_SETTINGS_KEY)) {
            saveTextSettings({ ...DEFAULT_TEXT_SETTINGS });
        }

        // Initialize default template if no templates exist
        await initializeDefaultTemplate();

        // Sync from GitHub if enabled
        if (isGitHubEnabled()) {
            const result = await syncFromGitHub();
            if (result.success) {
                console.log('Synced from GitHub on init');
            }
        }

        // Check session
        if (verifySession()) {
            showApp();
            renderTemplatesList();
            renderTemplateSelect();
            renderEntriesList();
            loadTextSettingsForm();
            loadGitHubSettingsForm();
            updateSyncStatus();
        } else {
            showLogin();
        }
    }

    // Load GitHub settings form
    function loadGitHubSettingsForm() {
        const config = getGitHubConfig();
        
        const enabledEl = document.getElementById('githubEnabled');
        const tokenEl = document.getElementById('githubToken');
        const ownerEl = document.getElementById('githubOwner');
        const repoEl = document.getElementById('githubRepo');
        const branchEl = document.getElementById('githubBranch');
        
        if (enabledEl) enabledEl.checked = config.enabled;
        if (tokenEl) tokenEl.value = config.token;
        if (ownerEl) ownerEl.value = config.owner;
        if (repoEl) repoEl.value = config.repo;
        if (branchEl) branchEl.value = config.branch;
    }

    // Run initialization
    init();

})();