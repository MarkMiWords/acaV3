/**
 * ===================================================================
 * The Sovereign Forge - Application Logic
 * ACA V3 - Local-first writing workspace
 * ===================================================================
 */

// ===================================================================
// IndexedDB Storage System
// ===================================================================

const DB_NAME = 'ForgeDB';
const DB_VERSION = 1;
const STORE_NAME = 'sheets';

let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

function saveSheetToDB(sheet) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(sheet);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllSheetsFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getSheetFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteSheetFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===================================================================
// Application State
// ===================================================================

const state = {
  currentSheetId: null,
  sheets: [],
  saveTimeout: null,
  lastSavedContent: '',
  liveLinkActive: false,
  panelWidths: {
    left: 220,
    right: 320
  }
};

// ===================================================================
// DOM References
// ===================================================================

const elements = {
  // Navigator
  homeBtn: document.getElementById('home-btn'),
  newSheetBtn: document.getElementById('new-sheet-btn'),
  liveLinkBtn: document.getElementById('live-link-btn'),
  saveToVaultBtn: document.getElementById('save-to-vault-btn'),
  currentEditingTitle: document.getElementById('current-editing-title'),
  sheetList: document.getElementById('sheet-list'),

  // Sheet Editor
  sheetTitle: document.getElementById('sheet-title'),
  sheetEditor: document.getElementById('sheet-editor'),

  // WRAP Hub
  wrapHubBtns: document.querySelectorAll('.wrap-hub-btn'),
  wrapDropdowns: document.querySelectorAll('.wrap-dropdown'),

  // Revise Tools
  rinseBtn: document.getElementById('rinse-btn'),
  washBtn: document.getElementById('wash-btn'),

  // Help Modes
  helpModeBtns: document.querySelectorAll('.help-mode-btn'),

  // WRAP Partner
  partnerMessages: document.getElementById('partner-messages'),
  partnerInput: document.getElementById('partner-input'),
  partnerSendBtn: document.getElementById('partner-send-btn'),

  // Status Bar
  statusWords: document.getElementById('status-words'),
  statusContext: document.getElementById('status-context'),
  statusVault: document.getElementById('status-vault'),

  // Word Warning Modal
  wordWarningModal: document.getElementById('word-warning-modal'),
  warningWordCount: document.getElementById('warning-word-count'),
  closeWarningBtn: document.getElementById('close-warning-btn'),
  newSheetFromWarningBtn: document.getElementById('new-sheet-from-warning-btn'),

  // Live Link Modal
  liveLinkModal: document.getElementById('live-link-modal'),
  guardrailsAcceptCheck: document.getElementById('guardrails-accept-check'),
  initializeLiveLinkBtn: document.getElementById('initialize-live-link-btn'),
  cancelLiveLinkBtn: document.getElementById('cancel-live-link-btn'),

  // Panels & Resizers
  workspace: document.querySelector('.forge-workspace'),
  resizers: document.querySelectorAll('.resizer')
};

// ===================================================================
// WRAP Hub Dropdowns
// ===================================================================

function initWrapHub() {
  elements.wrapHubBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrapName = btn.dataset.wrap;

      const dropdown = document.getElementById(`dropdown-${wrapName}`);
      if (!dropdown) return;

      const isOpen = dropdown.classList.contains('open');

      // Close all dropdowns first
      closeAllDropdowns();

      // Toggle the clicked one
      if (!isOpen) {
        dropdown.classList.add('open');
        btn.classList.add('open');
      }
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.wrap-btn-group')) {
      closeAllDropdowns();
    }
  });

  // Prevent dropdown content clicks from closing the dropdown
  elements.wrapDropdowns.forEach(dropdown => {
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

function closeAllDropdowns() {
  elements.wrapDropdowns.forEach(d => d.classList.remove('open'));
  elements.wrapHubBtns.forEach(b => b.classList.remove('open'));
}

// ===================================================================
// Sheet Management
// ===================================================================

async function createNewSheet() {
  const now = new Date().toISOString();
  const sheet = {
    id: `sheet_${Date.now()}`,
    title: 'Untitled Sheet',
    content: '',
    createdAt: now,
    updatedAt: now,
    wordCount: 0
  };

  try {
    await saveSheetToDB(sheet);
    state.sheets.push(sheet);
    await loadSheet(sheet.id);
    renderSheetList();
  } catch (error) {
    console.error('Error creating new sheet:', error);
  }
}

async function loadSheet(sheetId) {
  try {
    const sheet = await getSheetFromDB(sheetId);
    if (!sheet) {
      console.error('Sheet not found:', sheetId);
      return;
    }

    state.currentSheetId = sheetId;
    elements.sheetTitle.value = sheet.title;
    elements.sheetEditor.innerHTML = sheet.content;
    state.lastSavedContent = sheet.content;

    elements.currentEditingTitle.textContent = sheet.title || 'Untitled Sheet';

    updateWordCount();
    renderSheetList();

    localStorage.setItem('lastOpenedSheet', sheetId);
  } catch (error) {
    console.error('Error loading sheet:', error);
  }
}

function getCurrentSheet() {
  return state.sheets.find(s => s.id === state.currentSheetId);
}

function updateCurrentSheet() {
  const sheet = getCurrentSheet();
  if (!sheet) return;

  sheet.title = elements.sheetTitle.value || 'Untitled Sheet';
  sheet.content = elements.sheetEditor.innerHTML;
  sheet.updatedAt = new Date().toISOString();
  sheet.wordCount = countWords(elements.sheetEditor.textContent);

  elements.currentEditingTitle.textContent = sheet.title;

  debouncedSave();
}

function debouncedSave() {
  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
  }

  state.saveTimeout = setTimeout(async () => {
    const sheet = getCurrentSheet();
    if (!sheet) return;

    try {
      await saveSheetToDB(sheet);
      state.lastSavedContent = sheet.content;
      renderSheetList();
    } catch (error) {
      console.error('Error saving sheet:', error);
    }
  }, 1000);
}

// ===================================================================
// Word Counting & Status Bar
// ===================================================================

function countWords(text) {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned.length === 0 ? 0 : cleaned.split(' ').length;
}

function updateWordCount() {
  const text = elements.sheetEditor.textContent;
  const words = countWords(text);

  elements.statusWords.textContent = `Words: ${words}`;

  if (words >= 1000) {
    if (words === 1000) {
      handleWordLimit();
    }
  } else if (words >= 900) {
    if (words === 900) {
      showWordWarning();
    }
  }
}

function showWordWarning() {
  const words = countWords(elements.sheetEditor.textContent);
  elements.warningWordCount.textContent = words;
  elements.wordWarningModal.classList.remove('hidden');
}

async function handleWordLimit() {
  const sheet = getCurrentSheet();
  if (sheet) {
    await saveSheetToDB(sheet);
  }
  await createNewSheet();
}

// ===================================================================
// Navigator UI
// ===================================================================

function renderSheetList() {
  elements.sheetList.innerHTML = '';

  if (state.sheets.length === 0) return;

  const sorted = [...state.sheets].sort((a, b) =>
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  sorted.forEach(sheet => {
    const li = document.createElement('li');
    li.className = 'sheet-list-item';
    if (sheet.id === state.currentSheetId) {
      li.classList.add('active');
    }

    li.innerHTML = `
      <div class="sheet-list-item-title">${sheet.title}</div>
      <div class="sheet-list-item-meta">
        <span>${sheet.wordCount || 0} words</span>
        <span>${formatDate(sheet.updatedAt)}</span>
      </div>
    `;

    li.addEventListener('click', () => loadSheet(sheet.id));
    elements.sheetList.appendChild(li);
  });
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

  return date.toLocaleDateString();
}

// ===================================================================
// Panel Resizing
// ===================================================================

function initPanelResizing() {
  const saved = localStorage.getItem('panelWidths');
  if (saved) {
    state.panelWidths = JSON.parse(saved);
    applyPanelWidths();
  }

  elements.resizers.forEach(resizer => {
    let startX, startWidth;
    const isLeftResizer = resizer.dataset.resizer === 'left';

    resizer.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startWidth = isLeftResizer ? state.panelWidths.left : state.panelWidths.right;

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      resizer.classList.add('active');
      e.preventDefault();
    });

    function handleMouseMove(e) {
      const diff = e.clientX - startX;

      if (isLeftResizer) {
        const newWidth = Math.max(200, Math.min(600, startWidth + diff));
        state.panelWidths.left = newWidth;
      } else {
        const newWidth = Math.max(200, Math.min(600, startWidth - diff));
        state.panelWidths.right = newWidth;
      }

      applyPanelWidths();
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      resizer.classList.remove('active');

      localStorage.setItem('panelWidths', JSON.stringify(state.panelWidths));
    }
  });
}

function applyPanelWidths() {
  elements.workspace.style.gridTemplateColumns =
    `${state.panelWidths.left}px var(--resizer-width) 1fr var(--resizer-width) ${state.panelWidths.right}px`;
}

// ===================================================================
// WRAP Partner
// ===================================================================

function addPartnerMessage(content, type = 'assistant') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `partner-message ${type}`;

  if (typeof content === 'string') {
    messageDiv.innerHTML = `<p>${content}</p>`;
  } else {
    messageDiv.appendChild(content);
  }

  elements.partnerMessages.appendChild(messageDiv);
  elements.partnerMessages.scrollTop = elements.partnerMessages.scrollHeight;
}

async function sendPartnerMessage() {
  const message = elements.partnerInput.value.trim();
  if (!message) return;

  addPartnerMessage(message, 'user');
  elements.partnerInput.value = '';

  addPartnerMessage('Thinking...', 'system');

  try {
    const response = await fetch('/api/partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sheetContent: elements.sheetEditor.textContent
      })
    });

    if (!response.ok) throw new Error('Partner request failed');

    const data = await response.json();

    // Remove thinking indicator
    const messages = elements.partnerMessages.querySelectorAll('.partner-message');
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.textContent === 'Thinking...') {
      lastMessage.remove();
    }

    if (data.suggestion) {
      const suggestionCard = document.createElement('div');
      suggestionCard.className = 'suggestion-card';
      suggestionCard.innerHTML = `
        <div class="suggestion-text">${data.suggestion}</div>
        <button class="apply-suggestion-btn">Apply to Sheet</button>
      `;

      suggestionCard.querySelector('.apply-suggestion-btn').addEventListener('click', () => {
        applySuggestionToSheet(data.suggestion);
      });

      const container = document.createElement('div');
      container.appendChild(document.createTextNode(data.response || 'Here\'s a suggestion:'));
      container.appendChild(suggestionCard);

      addPartnerMessage(container, 'assistant');
    } else {
      addPartnerMessage(data.response, 'assistant');
    }
  } catch (error) {
    console.error('Partner error:', error);

    const messages = elements.partnerMessages.querySelectorAll('.partner-message');
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.textContent === 'Thinking...') {
      lastMessage.remove();
    }

    addPartnerMessage('Sorry, I encountered an error. Please try again.', 'system');
  }
}

function applySuggestionToSheet(text) {
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);

  const textNode = document.createTextNode(' ' + text + ' ');
  range.insertNode(textNode);

  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);

  updateCurrentSheet();
  updateWordCount();
}

// ===================================================================
// Help Modes
// ===================================================================

const helpModeMessages = {
  'get-started': 'Let\'s get started. What\'s the story you want to tell? Just give me a sentence or a feeling — I\'ll help you find the thread.',
  'make-heading': 'What\'s this piece about? Give me the theme or topic and I\'ll suggest a title.',
  'research': 'What topic do you need to explore? I can help you gather context and background for your writing.',
  'guided': 'I\'ll walk you through it step by step. First — who is this story about? Give me a name (real or made up).',
  'stories': 'Let\'s weave your sheets together. Which sheets should I look at, and what\'s the bigger story you\'re building?'
};

function initHelpModes() {
  elements.helpModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active state
      elements.helpModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode;
      const message = helpModeMessages[mode];
      if (message) {
        addPartnerMessage(message, 'system');
      }
    });
  });
}

// ===================================================================
// Live Link
// ===================================================================

function initLiveLink() {
  // Open guardrails modal
  elements.liveLinkBtn.addEventListener('click', () => {
    if (state.liveLinkActive) {
      // Deactivate
      state.liveLinkActive = false;
      elements.liveLinkBtn.classList.remove('active');
      addPartnerMessage('Live Link disconnected.', 'system');
      return;
    }

    // Show guardrails
    elements.liveLinkModal.classList.remove('hidden');
    elements.guardrailsAcceptCheck.checked = false;
    elements.initializeLiveLinkBtn.disabled = true;
  });

  // Checkbox enables Initialize button
  elements.guardrailsAcceptCheck.addEventListener('change', () => {
    elements.initializeLiveLinkBtn.disabled = !elements.guardrailsAcceptCheck.checked;
  });

  // Initialize
  elements.initializeLiveLinkBtn.addEventListener('click', () => {
    elements.liveLinkModal.classList.add('hidden');
    state.liveLinkActive = true;
    elements.liveLinkBtn.classList.add('active');
    addPartnerMessage('Live Link initialized. Wrapp is listening.', 'system');
  });

  // Cancel
  elements.cancelLiveLinkBtn.addEventListener('click', () => {
    elements.liveLinkModal.classList.add('hidden');
  });
}

// ===================================================================
// Local Revise Tools
// ===================================================================

function rinseText() {
  let text = elements.sheetEditor.innerHTML;

  text = text.replace(/&nbsp;+/g, ' ');
  text = text.replace(/\s{2,}/g, ' ');
  text = text.replace(/\s+([.,!?;:])/g, '$1');
  text = text.replace(/([.,!?;:])\s*/g, '$1 ');
  text = text.trim();

  elements.sheetEditor.innerHTML = text;
  updateCurrentSheet();

  addPartnerMessage('Text rinsed: removed extra spaces and normalized punctuation.', 'system');
}

function washText() {
  const text = elements.sheetEditor.textContent;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  if (sentences.length < 4) {
    addPartnerMessage('Text looks good. Consider adding more content for better paragraph suggestions.', 'system');
    return;
  }

  const suggestion = `Consider adding paragraph breaks:\n\n` +
    `- After: "${sentences[2]?.trim().substring(0, 50)}..."\n` +
    (sentences[5] ? `- After: "${sentences[5]?.trim().substring(0, 50)}..."\n` : '');

  addPartnerMessage(suggestion, 'system');
}

// ===================================================================
// Theme
// ===================================================================

function loadTheme() {
  const saved = localStorage.getItem('forgeProfile');
  if (saved) {
    const profile = JSON.parse(saved);
    if (profile.theme) {
      document.documentElement.setAttribute('data-theme', profile.theme);
    }
  }
}

// ===================================================================
// Event Listeners
// ===================================================================

function initEventListeners() {
  // Navigator
  elements.newSheetBtn.addEventListener('click', createNewSheet);

  // Home button resets to most recent sheet
  elements.homeBtn.addEventListener('click', () => {
    if (state.sheets.length > 0) {
      const mostRecent = [...state.sheets].sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      loadSheet(mostRecent.id);
    }
    elements.sheetEditor.focus();
  });

  // Save to Vault
  elements.saveToVaultBtn.addEventListener('click', async () => {
    const sheet = getCurrentSheet();
    if (sheet) {
      await saveSheetToDB(sheet);
      addPartnerMessage('Sheet saved to Vault.', 'system');
    }
  });

  // Sheet Editor
  elements.sheetTitle.addEventListener('input', updateCurrentSheet);
  elements.sheetEditor.addEventListener('input', () => {
    updateCurrentSheet();
    updateWordCount();
  });

  // Revise Tools
  elements.rinseBtn.addEventListener('click', rinseText);
  elements.washBtn.addEventListener('click', washText);

  // WRAP Partner
  elements.partnerSendBtn.addEventListener('click', sendPartnerMessage);
  elements.partnerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPartnerMessage();
    }
  });

  // Word Warning Modal
  elements.closeWarningBtn.addEventListener('click', () => {
    elements.wordWarningModal.classList.add('hidden');
  });

  elements.newSheetFromWarningBtn.addEventListener('click', async () => {
    elements.wordWarningModal.classList.add('hidden');
    await createNewSheet();
  });
}

// ===================================================================
// Initialization
// ===================================================================

async function init() {
  try {
    loadTheme();

    await initDB();
    console.log('Database initialized');

    state.sheets = await getAllSheetsFromDB();
    console.log(`Loaded ${state.sheets.length} sheets`);

    // Check for ?sheet= URL param (from Vault "Open in Forge")
    const urlParams = new URLSearchParams(window.location.search);
    const requestedSheet = urlParams.get('sheet');
    const lastOpened = localStorage.getItem('lastOpenedSheet');

    if (requestedSheet && state.sheets.some(s => s.id === requestedSheet)) {
      await loadSheet(requestedSheet);
      // Clean URL without reload
      window.history.replaceState({}, '', '/');
    } else if (state.sheets.length === 0) {
      await createNewSheet();
    } else if (lastOpened && state.sheets.some(s => s.id === lastOpened)) {
      await loadSheet(lastOpened);
    } else {
      const mostRecent = state.sheets.sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      await loadSheet(mostRecent.id);
    }

    renderSheetList();
    initPanelResizing();
    initWrapHub();
    initHelpModes();
    initLiveLink();
    initEventListeners();

    console.log('The Sovereign Forge is ready');

  } catch (error) {
    console.error('Initialization error:', error);
    addPartnerMessage(`Error initializing: ${error.message}`, 'system');
  }
}

window.addEventListener('DOMContentLoaded', init);
