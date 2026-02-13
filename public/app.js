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
  partnerHistory: [],
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
  scrubBtn: document.getElementById('scrub-btn'),

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

  // Delete Sheet Modal
  deleteSheetModal: document.getElementById('delete-sheet-modal'),
  confirmDeleteSheetBtn: document.getElementById('confirm-delete-sheet-btn'),
  cancelDeleteSheetBtn: document.getElementById('cancel-delete-sheet-btn'),

  // Import Text Modal
  importTextBtn: document.getElementById('import-text-btn'),
  importTextModal: document.getElementById('import-text-modal'),
  importTextArea: document.getElementById('import-text-area'),
  importAppendBtn: document.getElementById('import-append-btn'),
  importReplaceBtn: document.getElementById('import-replace-btn'),
  importCancelBtn: document.getElementById('import-cancel-btn'),
  importFileZone: document.getElementById('import-file-zone'),
  importFileInput: document.getElementById('import-file-input'),
  importFileName: document.getElementById('import-file-name'),
  importFileNameText: document.getElementById('import-file-name-text'),
  importFileClear: document.getElementById('import-file-clear'),

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

    // Reset partner conversation for new sheet context
    state.partnerHistory = [];

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
      <div class="sheet-list-item-header">
        <div class="sheet-list-item-title">${sheet.title}</div>
        <button class="sheet-list-item-delete" title="Delete sheet">&times;</button>
      </div>
      <div class="sheet-list-item-meta">
        <span>${sheet.wordCount || 0} words</span>
        <span>${formatDate(sheet.updatedAt)}</span>
      </div>
    `;

    // Click to load (but not on delete button)
    li.addEventListener('click', (e) => {
      if (e.target.closest('.sheet-list-item-delete')) return;
      loadSheet(sheet.id);
    });

    // Delete button
    li.querySelector('.sheet-list-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteSheetModal(sheet.id, sheet.title);
    });

    elements.sheetList.appendChild(li);
  });
}

// ===================================================================
// Delete Sheet
// ===================================================================

let deleteSheetTargetId = null;

function showDeleteSheetModal(id, title) {
  deleteSheetTargetId = id;
  document.getElementById('delete-sheet-title-text').textContent = title || 'Untitled Sheet';
  elements.deleteSheetModal.classList.remove('hidden');
}

function hideDeleteSheetModal() {
  deleteSheetTargetId = null;
  elements.deleteSheetModal.classList.add('hidden');
}

async function confirmDeleteSheet() {
  if (!deleteSheetTargetId) return;

  const id = deleteSheetTargetId;

  try {
    await deleteSheetFromDB(id);
    state.sheets = state.sheets.filter(s => s.id !== id);

    if (localStorage.getItem('lastOpenedSheet') === id) {
      localStorage.removeItem('lastOpenedSheet');
    }

    // If we deleted the active sheet, load another or create new
    if (state.currentSheetId === id) {
      if (state.sheets.length > 0) {
        const mostRecent = [...state.sheets].sort((a, b) =>
          new Date(b.updatedAt) - new Date(a.updatedAt)
        )[0];
        await loadSheet(mostRecent.id);
      } else {
        await createNewSheet();
      }
    }

    renderSheetList();
    hideDeleteSheetModal();
    addPartnerMessage('Sheet deleted.', 'system');

  } catch (error) {
    console.error('Delete sheet error:', error);
    addPartnerMessage('Error deleting sheet.', 'system');
  }
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

function removeThinkingIndicator() {
  const messages = elements.partnerMessages.querySelectorAll('.partner-message');
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.textContent === 'Thinking...') {
    lastMessage.remove();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function sendPartnerMessage() {
  const message = elements.partnerInput.value.trim();
  if (!message) return;

  addPartnerMessage(message, 'user');
  elements.partnerInput.value = '';

  // Track in conversation history
  state.partnerHistory.push({ role: 'user', text: message });

  addPartnerMessage('Thinking...', 'system');

  try {
    const response = await fetch('/api/partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sheetContent: elements.sheetEditor.textContent,
        history: state.partnerHistory.slice(0, -1)
      })
    });

    if (!response.ok) throw new Error('Partner request failed');

    const data = await response.json();

    removeThinkingIndicator();

    // Track assistant response in history
    state.partnerHistory.push({ role: 'model', text: data.response });

    if (data.suggestion) {
      const suggestionCard = document.createElement('div');
      suggestionCard.className = 'suggestion-card';
      suggestionCard.innerHTML = `
        <div class="suggestion-text">${escapeHtml(data.suggestion)}</div>
        <button class="apply-suggestion-btn">Apply to Sheet</button>
      `;

      suggestionCard.querySelector('.apply-suggestion-btn').addEventListener('click', () => {
        applySuggestionToSheet(data.suggestion);
      });

      const container = document.createElement('div');
      const responseP = document.createElement('p');
      responseP.textContent = data.response || 'Here\'s a suggestion:';
      container.appendChild(responseP);
      container.appendChild(suggestionCard);

      addPartnerMessage(container, 'assistant');
    } else {
      addPartnerMessage(data.response, 'assistant');
    }
  } catch (error) {
    console.error('Partner error:', error);
    removeThinkingIndicator();
    addPartnerMessage('Sorry, I encountered an error. Please try again.', 'system');

    // Remove the failed user message from history
    state.partnerHistory.pop();
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
// Import Text
// ===================================================================

// Holds parsed HTML from a file upload (cleared when modal resets)
let importedFileHtml = '';
let importedFileTitle = '';

function initImportText() {
  // Open modal
  elements.importTextBtn.addEventListener('click', () => {
    closeAllDropdowns();
    resetImportModal();
    elements.importTextModal.classList.remove('hidden');
  });

  // File input change
  elements.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
  });

  // Drag and drop
  elements.importFileZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.importFileZone.classList.add('dragover');
  });

  elements.importFileZone.addEventListener('dragleave', () => {
    elements.importFileZone.classList.remove('dragover');
  });

  elements.importFileZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.importFileZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });

  // Clear file
  elements.importFileClear.addEventListener('click', () => {
    importedFileHtml = '';
    elements.importFileInput.value = '';
    elements.importFileName.classList.add('hidden');
  });

  // Append
  elements.importAppendBtn.addEventListener('click', () => {
    const html = getImportHtml();
    if (!html) return;

    elements.sheetEditor.innerHTML += html;
    finishImport('appended');
  });

  // Replace
  elements.importReplaceBtn.addEventListener('click', () => {
    const html = getImportHtml();
    if (!html) return;

    elements.sheetEditor.innerHTML = html;
    finishImport('replaced');
  });

  // Cancel
  elements.importCancelBtn.addEventListener('click', () => {
    elements.importTextModal.classList.add('hidden');
  });
}

function resetImportModal() {
  importedFileHtml = '';
  importedFileTitle = '';
  elements.importTextArea.value = '';
  elements.importFileInput.value = '';
  elements.importFileName.classList.add('hidden');
}

/**
 * Returns HTML content from either the uploaded file or the paste area.
 * File takes priority if present.
 */
function getImportHtml() {
  // File content takes priority
  if (importedFileHtml) return importedFileHtml;

  // Fall back to paste area
  const text = elements.importTextArea.value.trim();
  if (!text) return '';

  // Convert plain text to paragraphs
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function finishImport(action) {
  // Apply extracted H1 as sheet title if present
  if (importedFileTitle) {
    elements.sheetTitle.value = importedFileTitle;
    elements.currentEditingTitle.textContent = importedFileTitle;
  }

  updateCurrentSheet();
  updateWordCount();
  elements.importTextModal.classList.add('hidden');

  const words = countWords(elements.sheetEditor.textContent);
  let msg = `Import complete — ${action} sheet content. Sheet now has ${words} words.`;
  if (importedFileTitle) {
    msg += ` Title set to "${importedFileTitle}".`;
  }
  addPartnerMessage(msg, 'system');
}

/**
 * Handle an uploaded file: .txt, .docx, .html/.htm
 */
async function handleImportFile(file) {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();

  // Show file name
  elements.importFileNameText.textContent = file.name;
  elements.importFileName.classList.remove('hidden');

  try {
    if (ext === 'txt') {
      const text = await file.text();
      const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      importedFileHtml = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

    } else if (ext === 'docx' || ext === 'doc') {
      if (typeof mammoth === 'undefined') {
        addPartnerMessage('Word document support is loading. Please try again in a moment.', 'system');
        return;
      }
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });

      if (result.messages.length > 0) {
        console.warn('Mammoth warnings:', result.messages);
      }

      importedFileHtml = cleanImportedHtml(result.value);

    } else if (ext === 'html' || ext === 'htm') {
      const text = await file.text();
      importedFileHtml = cleanImportedHtml(text);

    } else {
      addPartnerMessage(`Unsupported file type: .${ext}. Use .txt, .docx, or .html.`, 'system');
      elements.importFileName.classList.add('hidden');
      return;
    }

    // Preview word count
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = importedFileHtml;
    const words = countWords(tempDiv.textContent);
    addPartnerMessage(`File loaded: "${file.name}" — ${words} words ready to import.`, 'system');

  } catch (error) {
    console.error('File import error:', error);
    addPartnerMessage(`Error reading file: ${error.message}`, 'system');
    importedFileHtml = '';
    elements.importFileName.classList.add('hidden');
  }
}

/**
 * Clean imported HTML — strip scripts, styles, and heavy formatting.
 * Keep paragraphs, headings, lists, line breaks, bold, italic.
 * Extracts the first H1 as the sheet title.
 */
function cleanImportedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove scripts, styles, meta tags
  doc.querySelectorAll('script, style, meta, link, head').forEach(el => el.remove());

  // Get body content (or full content if no body)
  const body = doc.body || doc.documentElement;

  // Extract first H1 as title, then remove it from the body
  const firstH1 = body.querySelector('h1');
  if (firstH1) {
    importedFileTitle = firstH1.textContent.trim();
    firstH1.remove();
  }

  // Strip all attributes to remove inline styles and classes
  body.querySelectorAll('*').forEach(el => {
    const attrs = [...el.attributes];
    attrs.forEach(attr => el.removeAttribute(attr.name));
  });

  return body.innerHTML.trim();
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

async function washText() {
  const text = elements.sheetEditor.textContent;
  if (countWords(text) < 10) {
    addPartnerMessage('Write a bit more before washing — there\'s not enough to work with yet.', 'system');
    return;
  }
  closeAllDropdowns();
  await runReviseTool('wash');
}

async function scrubText() {
  const text = elements.sheetEditor.textContent;
  if (countWords(text) < 30) {
    addPartnerMessage('Write more before scrubbing — structural suggestions need a longer piece.', 'system');
    return;
  }
  closeAllDropdowns();
  await runReviseTool('scrub');
}

async function runReviseTool(tool) {
  const toolLabel = tool === 'wash' ? 'Washing' : 'Scrubbing';
  addPartnerMessage(`${toolLabel} your text...`, 'system');

  try {
    const response = await fetch('/api/revise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetContent: elements.sheetEditor.textContent,
        tool
      })
    });

    if (!response.ok) throw new Error('Revise request failed');

    const data = await response.json();

    removeThinkingIndicator();

    if (!data.suggestions || data.suggestions.length === 0) {
      addPartnerMessage('No suggestions — your writing looks solid.', 'system');
      return;
    }

    const container = document.createElement('div');

    const header = document.createElement('p');
    header.textContent = tool === 'wash' ? 'Clarity suggestions:' : 'Structural suggestions:';
    header.style.fontWeight = 'bold';
    container.appendChild(header);

    data.suggestions.forEach(function(s) {
      const card = document.createElement('div');
      card.className = 'suggestion-card';

      const typeLabel = document.createElement('span');
      typeLabel.style.textTransform = 'uppercase';
      typeLabel.style.fontSize = '0.7em';
      typeLabel.style.opacity = '0.6';
      typeLabel.textContent = s.type || 'suggestion';
      card.appendChild(typeLabel);

      const reason = document.createElement('div');
      reason.className = 'suggestion-text';
      reason.textContent = s.reason || s.suggestion || '';
      card.appendChild(reason);

      if (s.suggestion && s.type !== 'info') {
        const applyBtn = document.createElement('button');
        applyBtn.className = 'apply-suggestion-btn';
        applyBtn.textContent = 'Apply to Sheet';
        applyBtn.addEventListener('click', function() {
          applySuggestionToSheet(s.suggestion);
        });
        card.appendChild(applyBtn);
      }

      container.appendChild(card);
    });

    addPartnerMessage(container, 'assistant');
  } catch (error) {
    console.error('Revise error:', error);
    removeThinkingIndicator();
    addPartnerMessage(`Sorry, the ${tool} tool encountered an error. Please try again.`, 'system');
  }
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
  elements.scrubBtn.addEventListener('click', scrubText);

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

  // Delete Sheet Modal
  elements.confirmDeleteSheetBtn.addEventListener('click', confirmDeleteSheet);
  elements.cancelDeleteSheetBtn.addEventListener('click', hideDeleteSheetModal);
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
    initImportText();
    initEventListeners();

    console.log('The Sovereign Forge is ready');

  } catch (error) {
    console.error('Initialization error:', error);
    addPartnerMessage(`Error initializing: ${error.message}`, 'system');
  }
}

window.addEventListener('DOMContentLoaded', init);
