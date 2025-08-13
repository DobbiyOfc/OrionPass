// Orion Vault Content Script - v12
// Handles "Save Login" notification after page redirect using an encrypted temporary store.

(() => {
    // --- STATE & CONFIGURATION ---
    let activeInput = null;   // The currently focused input element
    let popup = null;         // The Shadow DOM host for the autofill popup
    let saveLoginNotification = null; // The Shadow DOM host for the "Save Login" prompt
    let keyIcon = null;       // The floating key icon element
    let isPopupClosing = false; // Prevents re-opening popup immediately after closing
    let disabledSites = [];   // Local cache of sites disabled for autofill

    const KEY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`;
    const OPTIONS_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
    const USER_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;


    // --- CENTRAL LOGIN DETECTION LOGIC ---
    async function processPotentialLogin(form) {
        // Guard against processing the same form multiple times in the same event tick (e.g., from click and submit)
        if (!form || form.tagName !== 'FORM' || form.dataset.orionVaultProcessed) {
            return;
        }

        const passwordInput = Array.from(form.querySelectorAll('input[type="password"]')).find(p => p.value && p.offsetParent !== null);
        if (!passwordInput) {
            return;
        }

        const usernameInput = findUsernameInput(passwordInput);
        if (!usernameInput || !usernameInput.value) {
            return;
        }

        if (disabledSites.includes(window.location.hostname)) {
            console.log("Orion Vault: Login detection aborted, site is disabled.");
            return;
        }
        
        console.log("Orion Vault: Potential login detected.", { form });

        // Mark as processed and then unmark after a short delay
        form.dataset.orionVaultProcessed = 'true';
        setTimeout(() => {
            if (form) delete form.dataset.orionVaultProcessed;
        }, 200);

        const payload = {
            username: usernameInput.value,
            password: passwordInput.value,
            url: window.location.href,
        };
        
        try {
            console.log("Orion Vault: Sending credentials for encryption...", payload);
            const response = await chrome.runtime.sendMessage({ action: 'encryptPendingLogin', payload });
            
            if (response && response.success) {
                console.log("Orion Vault: Received encrypted blob from background.", response.encryptedBlob);
                const dataToStore = {
                    encryptedBlob: response.encryptedBlob,
                    timestamp: Date.now()
                };
                sessionStorage.setItem('orion_vault_pending_login', JSON.stringify(dataToStore));
                console.log("Orion Vault: Stored pending login in sessionStorage.");
            } else {
                console.error("Orion Vault: Failed to get encrypted blob from background.", response?.error);
            }
        } catch (err) {
            console.error('Orion Vault: Could not encrypt and store pending login.', err);
        }
    }


    // --- INITIALIZATION ---
    function init() {
        chrome.runtime.sendMessage({ action: 'getDisabledSites' }, (response) => {
            if (response?.success) {
                disabledSites = response.sites || [];
            }
        });

        createKeyIcon();
        
        chrome.runtime.onMessage.addListener((request) => {
            if (request.action === 'disabledSitesUpdated') {
                disabledSites = request.payload.sites || [];
                if (popup && disabledSites.includes(window.location.hostname)) {
                    destroyPopup();
                }
            }
            if (request.action === 'showSaveLoginPrompt') {
                console.log("Orion Vault: Received request to show 'Save Login' prompt.");
                createSaveLoginNotification(request.payload);
            }
        });

        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);
        document.addEventListener('mousedown', handleMouseDown, true);
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('submit', handleFormSubmit, true);
        document.addEventListener('click', handlePossibleLoginClick, true);
        window.addEventListener('resize', () => { hideKeyIcon(); destroyPopup(); }, true);
        window.addEventListener('scroll', () => { hideKeyIcon(); destroyPopup(); }, true);
    }
    
    function checkPendingLogin() {
        console.log("Orion Vault: Checking for pending login on page load...");
        const pendingLoginJSON = sessionStorage.getItem('orion_vault_pending_login');
        if (pendingLoginJSON) {
            sessionStorage.removeItem('orion_vault_pending_login'); // Clear immediately to prevent re-triggering
            
            try {
                const pendingLogin = JSON.parse(pendingLoginJSON);
                console.log("Orion Vault: Found pending login data.", pendingLogin);
                
                // Only process if the submission is recent (e.g., within 15 seconds)
                if (Date.now() - pendingLogin.timestamp > 15000) {
                    console.log("Orion Vault: Pending login is too old. Ignoring.");
                    return;
                }
                
                console.log("Orion Vault: Sending encrypted data to background for processing.");
                // Let the background script process the encrypted data
                chrome.runtime.sendMessage({
                    action: 'processEncryptedPendingLogin',
                    payload: pendingLogin.encryptedBlob
                });

            } catch (e) {
                console.error("Orion Vault: Error parsing encrypted pending login from sessionStorage.", e);
            }
        } else {
             console.log("Orion Vault: No pending login found.");
        }
    }

    // --- DOM HELPERS ---
    function createElement(tag, properties, children = []) {
        const el = document.createElement(tag);
        Object.assign(el, properties);
        if (properties.style) {
            Object.assign(el.style, properties.style);
        }
        for (const child of children) {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child) {
                el.appendChild(child);
            }
        }
        return el;
    }


    // --- UI & DOM MANIPULATION ---
    function createKeyIcon() {
        if (keyIcon) return;
        keyIcon = document.createElement('button');
        keyIcon.style.position = 'absolute';
        keyIcon.style.zIndex = '2147483646';
        keyIcon.style.background = 'transparent';
        keyIcon.style.border = 'none';
        keyIcon.style.padding = '5px';
        keyIcon.style.cursor = 'pointer';
        keyIcon.style.display = 'none';
        keyIcon.style.color = '#9ca3af';
        keyIcon.innerHTML = KEY_ICON_SVG; // This is a static, safe string.
        
        keyIcon.addEventListener('mouseenter', () => keyIcon.style.color = '#e5e7eb');
        keyIcon.addEventListener('mouseleave', () => keyIcon.style.color = '#9ca3af');
        
        keyIcon.addEventListener('mousedown', e => e.preventDefault());
        keyIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePopup();
        });

        document.body.appendChild(keyIcon);
    }

    function showKeyIcon(input) {
        if (!keyIcon) createKeyIcon();
        const rect = input.getBoundingClientRect();
        keyIcon.style.display = 'flex';
        keyIcon.style.alignItems = 'center';
        keyIcon.style.justifyContent = 'center';
        keyIcon.style.height = `${rect.height}px`;
        keyIcon.style.top = `${window.scrollY + rect.top}px`;
        keyIcon.style.left = `${window.scrollX + rect.right - 28}px`;
    }

    function hideKeyIcon() {
        if (keyIcon) keyIcon.style.display = 'none';
    }

    function destroyPopup() {
        if (popup) {
            isPopupClosing = true;
            popup.remove();
            popup = null;
            setTimeout(() => { isPopupClosing = false; }, 100);
        }
    }

    function togglePopup() {
        if (popup) {
            destroyPopup();
        } else if (activeInput) {
            showPopupFor(activeInput, true);
        }
    }

    function showPopupFor(targetElement, triggeredByUser = false) {
        if (isPopupClosing || disabledSites.includes(window.location.hostname)) return;

        chrome.runtime.sendMessage(
            { action: 'getCredentialsForTab', payload: { url: window.location.href } },
            (response) => {
                if (chrome.runtime.lastError || !response?.success) {
                    console.warn(`Orion Vault: Error fetching credentials. ${chrome.runtime.lastError?.message || response?.error}`);
                    return;
                }
                if (document.activeElement === targetElement) {
                    if (response.isDisabled || response.isLocked) return;
                    
                    const logins = response.logins || [];
                    if (logins.length > 0 || triggeredByUser) {
                        createAutofillPopupUI(logins, targetElement);
                    }
                }
            }
        );
    }

    function createAutofillPopupUI(logins, targetElement) {
        destroyPopup();

        popup = document.createElement('div');
        popup.addEventListener('mousedown', e => e.preventDefault());

        const rect = targetElement.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.zIndex = '2147483647';
        popup.style.top = `${window.scrollY + rect.bottom + 2}px`;
        popup.style.left = `${window.scrollX + rect.left}px`;
        popup.style.width = `${Math.max(rect.width, 280)}px`;

        const shadowRoot = popup.attachShadow({ mode: 'open' });
        const styles = `
            .wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #28282d; color: #e1e1e3; border: 1px solid #4a4a52; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.4); overflow: hidden; padding: 4px; animation: fade-in 0.15s ease-out; }
            @keyframes fade-in { from { opacity: 0; transform: translateY(-5px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: #9a9aa0; padding: 4px 8px; }
            .header-btn { background: none; border: none; color: #9a9aa0; cursor: pointer; padding: 4px; border-radius: 4px; line-height: 0; }
            .header-btn:hover { background-color: #3a3a40; color: #e1e1e3; }
            ul { list-style: none; padding: 0; margin: 0; max-height: 180px; overflow-y: auto; }
            li button { display: flex; align-items: center; width: 100%; padding: 6px; border: none; background: none; text-align: left; cursor: pointer; border-radius: 6px; color: #e1e1e3; }
            li button:hover { background-color: #3a3a40; }
            .icon { width: 32px; height: 32px; margin-right: 12px; background-color: #3a3a40; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .icon svg { stroke: #c0c0c0; }
            .text-wrapper { min-width: 0; }
            .title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .username { font-size: 12px; color: #9a9aa0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .options-menu { position: absolute; top: 34px; right: 5px; background-color: #333338; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); border: 1px solid #555; z-index: 10; padding: 4px; display: none; min-width: 180px; }
            .options-menu button { display: block; width: 100%; padding: 8px 12px; font-size: 13px; text-align: left; background: none; border: none; color: #e1e1e3; border-radius: 4px; }
            .options-menu button:hover { background-color: #4a4a50; }
            .state-view { padding: 16px; text-align: center; }
            .state-view .title { font-size: 15px; font-weight: 600; }
            .state-view .subtitle { font-size: 13px; color: #9a9aa0; margin-top: 4px; }
        `;
        shadowRoot.appendChild(createElement('style', { textContent: styles }));

        const optionsBtn = createElement('button', { id: 'options-btn', title: 'More options', className: 'header-btn', innerHTML: OPTIONS_ICON_SVG });
        const doNotSuggestBtn = createElement('button', { id: 'do-not-suggest-btn', textContent: 'Do not suggest on this site' });
        const optionsMenu = createElement('div', { id: 'options-menu-popup', className: 'options-menu' }, [doNotSuggestBtn]);
        const header = createElement('div', { className: 'header' }, [
            createElement('span', { textContent: logins.length > 0 ? 'Sign in as...' : 'Orion Vault' }),
            createElement('div', { style: { position: 'relative' } }, [optionsBtn, optionsMenu])
        ]);

        let mainContent;
        if (logins.length > 0) {
            mainContent = createElement('ul', {}, logins.map((login, index) =>
                createElement('li', {}, [
                    createElement('button', { 'data-index': index, onclick: () => fillCredentials(login, targetElement) }, [
                        createElement('div', { className: 'icon', innerHTML: USER_ICON_SVG }),
                        createElement('div', { className: 'text-wrapper' }, [
                            createElement('div', { className: 'title', textContent: login.title }),
                            createElement('div', { className: 'username', textContent: login.username })
                        ])
                    ])
                ])
            ));
        } else {
            mainContent = createElement('div', { className: 'state-view' }, [
                createElement('div', { className: 'title', textContent: 'No Logins Found' }),
                createElement('div', { className: 'subtitle', textContent: 'No items for this site.' })
            ]);
        }
        
        shadowRoot.appendChild(createElement('div', { className: 'wrapper' }, [header, mainContent]));
        
        optionsBtn.addEventListener('click', e => { e.stopPropagation(); optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block'; });
        doNotSuggestBtn.addEventListener('click', e => { e.stopPropagation(); chrome.runtime.sendMessage({ action: 'disableSite', payload: { hostname: window.location.hostname } }); destroyPopup(); hideKeyIcon(); });
        
        document.body.appendChild(popup);
    }

    function createSaveLoginNotification(payload) {
        if (saveLoginNotification) saveLoginNotification.remove();

        const { username, password, url, vaults } = payload;
        let siteName;
        try { siteName = new URL(url).hostname; } catch { siteName = url; }

        saveLoginNotification = document.createElement('div');
        saveLoginNotification.style.position = 'fixed';
        saveLoginNotification.style.top = '20px';
        saveLoginNotification.style.right = '20px';
        saveLoginNotification.style.zIndex = '2147483647';
        saveLoginNotification.style.width = '360px';

        const shadowRoot = saveLoginNotification.attachShadow({ mode: 'open' });
        const styles = `
            :host { all: initial; font-family: 'Inter', -apple-system, sans-serif; }
            .wrapper { background-color: #181123; color: #f0f0f5; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); border: 1px solid rgba(255, 255, 255, 0.15); overflow: hidden; animation: slide-in 0.3s ease-out; }
            @keyframes slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
            .header-main { display: flex; align-items: center; gap: 12px; }
            .vault-select-wrapper { position: relative; }
            .vault-select-btn { display: flex; align-items: center; gap: 6px; background-color: rgba(255, 255, 255, 0.1); border: none; color: #f0f0f5; padding: 6px 12px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
            .vault-select-btn:hover { background-color: rgba(255, 255, 255, 0.15); }
            .vault-select-btn::after { content: '▾'; margin-left: 4px; font-size: 12px; }
            .header-controls { display: flex; align-items: center; gap: 4px; }
            .icon-btn { background: none; border: none; padding: 6px; cursor: pointer; color: #a0a0b0; border-radius: 50%; }
            .icon-btn:hover { background-color: rgba(255, 255, 255, 0.1); color: #fff; }
            .content { padding: 16px; }
            .title-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
            .site-icon { width: 32px; height: 32px; background: white; border-radius: 8px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; }
            .site-name { font-weight: 600; font-size: 18px; }
            .field { background-color: rgba(255, 255, 255, 0.05); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; }
            .field-label { font-size: 12px; color: #a0a0b0; margin-bottom: 2px; }
            .field-value { font-size: 14px; color: #f0f0f5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px; background-color: rgba(0,0,0,0.1); }
            .btn { border: none; padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: opacity 0.2s; }
            .btn:hover { opacity: 0.9; }
            .btn-secondary { background-color: rgba(255,255,255,0.15); color: #f0f0f5; }
            .btn-primary { background: linear-gradient(90deg, #6d28d9, #9333ea); color: white; }
            select { opacity: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; }
            #more-options-menu { display: none; position: absolute; right: 8px; top: 50px; background-color: #2a2238; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 10; }
            #more-options-menu button { display: block; width: 100%; text-align: left; background: none; border: none; color: #eee; padding: 8px 12px; font-size: 13px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
            #more-options-menu button:hover { background-color: rgba(255,255,255,0.1); }
        `;
        shadowRoot.appendChild(createElement('style', { textContent: styles }));

        const defaultVault = vaults.length > 0 ? vaults[0] : null;
        
        const vaultSelectBtn = createElement('button', { id: 'vault-select-btn', className: 'vault-select-btn', textContent: defaultVault?.name || 'Select' });
        const vaultSelector = createElement('select', { id: 'vault-selector' }, vaults.map(v =>
            createElement('option', { value: v.id, textContent: v.name, selected: v.id === defaultVault?.id })
        ));
        
        const closeBtn = createElement('button', { id: 'close-btn', className: 'icon-btn', title: 'Close', innerHTML: '<svg width="20" height="20" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' });
        const moreOptionsBtn = createElement('button', { id: 'more-options-btn', className: 'icon-btn', title: 'More options', innerHTML: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>' });
        
        const doNotSuggestBtn = createElement('button', { id: 'do-not-suggest-btn-save', textContent: 'Do not suggest on this site' });
        const moreOptionsMenu = createElement('div', { id: 'more-options-menu' }, [doNotSuggestBtn]);

        const wrapper = createElement('div', { className: 'wrapper' }, [
            createElement('header', { className: 'header' }, [
                createElement('div', { className: 'header-main' }, [
                    createElement('div', { innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>' }),
                    createElement('div', { className: 'vault-select-wrapper' }, [vaultSelectBtn, vaultSelector])
                ]),
                createElement('div', { className: 'header-controls' }, [moreOptionsBtn, closeBtn])
            ]),
            moreOptionsMenu,
            createElement('div', { className: 'content' }, [
                createElement('div', { className: 'title-bar' }, [
                    createElement('div', { className: 'site-icon' }, [
                        createElement('img', { src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(siteName)}&sz=32`, alt: '', width: 20, height: 20 })
                    ]),
                    createElement('span', { className: 'site-name', textContent: siteName })
                ]),
                createElement('div', { className: 'field' }, [
                    createElement('div', { className: 'field-label', textContent: 'Username or Email' }),
                    createElement('div', { className: 'field-value', textContent: username })
                ]),
                createElement('div', { className: 'field' }, [
                    createElement('div', { className: 'field-label', textContent: 'Password' }),
                    createElement('div', { className: 'field-value', textContent: '••••••••••••••' })
                ])
            ]),
            createElement('footer', { className: 'footer' }, [
                createElement('button', { id: 'not-now-btn', className: 'btn btn-secondary', textContent: 'Not now' }),
                createElement('button', { id: 'add-btn', className: 'btn btn-primary', textContent: 'Add' })
            ])
        ]);

        shadowRoot.appendChild(wrapper);
        document.body.appendChild(saveLoginNotification);

        const closeNotification = () => { if (saveLoginNotification) { saveLoginNotification.remove(); saveLoginNotification = null; } };
        closeBtn.addEventListener('click', closeNotification);
        shadowRoot.getElementById('not-now-btn').addEventListener('click', closeNotification);
        vaultSelector.addEventListener('change', (e) => { vaultSelectBtn.textContent = e.target.options[e.target.selectedIndex].text; });
        shadowRoot.getElementById('add-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'saveDetectedLogin', payload: { username, password, url, vaultId: parseInt(vaultSelector.value, 10) } }, (response) => {
                if (response?.success) closeNotification(); else console.error("Failed to save login:", response?.error);
            });
        });
        moreOptionsBtn.addEventListener('click', e => { e.stopPropagation(); moreOptionsMenu.style.display = moreOptionsMenu.style.display === 'block' ? 'none' : 'block'; });
        doNotSuggestBtn.addEventListener('click', () => { chrome.runtime.sendMessage({ action: 'disableSite', payload: { hostname: window.location.hostname } }); closeNotification(); });
        document.addEventListener('click', (e) => { if (moreOptionsMenu && !moreOptionsBtn.contains(e.target)) moreOptionsMenu.style.display = 'none'; }, true);
    }
    
    // --- CORE LOGIC ---

    function isLoginField(input) {
        if (!input || input.tagName !== 'INPUT' || input.offsetParent === null) {
            return false;
        }

        if (input.type === 'password') {
            return true;
        }

        if (input.type.match(/text|email|tel/)) {
            const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
            if (autocomplete.includes('username') || autocomplete.includes('email')) {
                return true;
            }

            const usernameRegex = /user|email|login/i;
            const isPotentialUsername = usernameRegex.test(input.name) || usernameRegex.test(input.id);

            if (isPotentialUsername) {
                const form = input.closest('form');
                if (form && form.querySelector('input[type="password"]')) {
                    return true;
                }
            }
        }
        return false;
    }

    function fillCredentials(login, currentInput) {
        const form = currentInput?.form;
        if (!form) return;
        const passwordField = Array.from(form.querySelectorAll('input[type="password"]')).find(el => el.offsetWidth > 0);
        const visibleInputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')).filter(el => el.offsetHeight > 0);
        let usernameField = form.querySelector('input[autocomplete="username"], input[autocomplete="email"]');
        if (!usernameField && passwordField) { const passwordIndex = visibleInputs.indexOf(passwordField); if (passwordIndex > 0) usernameField = visibleInputs[passwordIndex - 1]; }
        if (!usernameField) usernameField = visibleInputs.find(el => /user|login|email/i.test(el.name || '') || /user|login|email/i.test(el.id || '') || /user|login|email/i.test(el.placeholder || ''));
        if (!usernameField && currentInput !== passwordField && currentInput.type !== 'password') usernameField = currentInput;
        const setValue = (element, value) => { if (element && typeof value === 'string') { const lastValue = element.value; element.value = value; const event = new Event('input', { bubbles: true, composed: true }); const tracker = element._valueTracker; if (tracker) tracker.setValue(lastValue); element.dispatchEvent(event); } };
        setValue(passwordField, login.password);
        setValue(usernameField, login.username);
        destroyPopup();
        hideKeyIcon();
    }

    function findUsernameInput(passwordInput) {
        const form = passwordInput.form;
        if (!form) return null;

        const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'));
        const visibleInputs = inputs.filter(i => i.offsetParent !== null);

        // Priority 1: Semantic attributes on visible inputs
        for (const input of visibleInputs) {
            const autocomplete = input.getAttribute('autocomplete');
            if (autocomplete === 'username' || autocomplete === 'email') {
                return input;
            }
            if (input.type === 'email') {
                return input;
            }
        }
        
        // Priority 2: Common names/IDs on visible, text-like inputs
        const usernameRegex = /user|email|login/i;
        const potentialUsernameFields = visibleInputs.filter(i => 
            i.type.match(/text|email|url|search|tel/) &&
            (usernameRegex.test(i.name) || usernameRegex.test(i.id))
        );
        if (potentialUsernameFields.length > 0) {
            return potentialUsernameFields[0];
        }

        // Priority 3: Positional fallback for visible inputs
        const passwordIndex = visibleInputs.indexOf(passwordInput);
        if (passwordIndex > 0) {
            const precedingInput = visibleInputs[passwordIndex - 1];
            if (precedingInput.type.match(/text|email|url|search|tel/) && precedingInput.type !== 'password') {
                return precedingInput;
            }
        }

        return null;
    }

    // --- EVENT HANDLERS ---
    function handleFocusIn(e) {
        const input = e.target;

        if (!isLoginField(input) || disabledSites.includes(window.location.hostname)) {
            if (activeInput) {
                hideKeyIcon();
                destroyPopup();
                activeInput = null;
            }
            return;
        }
        
        if (activeInput && activeInput !== input) {
            hideKeyIcon();
            destroyPopup();
        }
        
        activeInput = input;
        showKeyIcon(input);
        
        setTimeout(() => {
            if (document.activeElement === activeInput) {
                showPopupFor(activeInput, false);
            }
        }, 150);
    }

    function handleFocusOut() {
        setTimeout(() => {
            if (document.activeElement !== activeInput && (!popup || !popup.contains(document.activeElement)) && (!saveLoginNotification || !saveLoginNotification.contains(document.activeElement))) {
                hideKeyIcon();
                if(activeInput) destroyPopup();
                activeInput = null;
            }
        }, 100);
    }
    
    function handleMouseDown(e) {
        if (popup && !e.composedPath().includes(popup)) {
            destroyPopup();
            hideKeyIcon();
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            destroyPopup();
            hideKeyIcon();
            if (saveLoginNotification) { saveLoginNotification.remove(); saveLoginNotification = null; }
        }
    }

    function handleFormSubmit(e) {
        processPotentialLogin(e.target);
    }

    function handlePossibleLoginClick(e) {
        const button = e.target.closest('button, input[type="submit"], [role="button"]');
        if (!button) return;

        const form = button.closest('form');
        if (form) {
            if (form.querySelector('input[type="password"]')) {
                setTimeout(() => processPotentialLogin(form), 150);
            }
        }
    }

    // --- STARTUP ---
    // Check for a pending login immediately when the script runs.
    // This is crucial for catching data after fast redirects.
    checkPendingLogin();

    // The rest of the initialization (attaching event listeners) can wait for the DOM to be ready.
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init, { once: true });
    }
})();