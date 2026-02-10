/**
 * ===================================================================
 * The Forge - Application Logic
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

/**
 * Initialize IndexedDB
 */
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

/**
 * Save a sheet to IndexedDB
 */
function saveSheetToDB(sheet) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(sheet);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all sheets from IndexedDB
 */
function getAllSheetsFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single sheet by ID
 */
function getSheetFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a sheet from IndexedDB
 */
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
  panelWidths: {
    left: 300,
    right: 350
  }
};

// ===================================================================
// DOM References
// ===================================================================

const elements = {
  // Navigator
  homeBtn: document.getElementById('home-btn'),
  newSheetBtn: document.getElementById('new-sheet-btn'),
  sheetList: document.getElementById('sheet-list'),
  
  // Sheet Editor
  sheetTitle: document.getElementById('sheet-title'),
  sheetEditor: document.getElementById('sheet-editor'),
  wordCount: document.getElementById('word-count'),
  saveStatus: document.getElementById('save-status'),
  
  // Revise Tools
  rinseBtn: document.getElementById('rinse-btn'),
  washBtn: document.getElementById('wash-btn'),
  scrubBtn: document.getElementById('scrub-btn'),
  
  // WRAP Partner
  partnerMessages: document.getElementById('partner-messages'),
  partnerInput: document.getElementById('partner-input'),
  partnerSendBtn: document.getElementById('partner-send-btn'),
  
  // Modals
  wordWarningModal: document.getElementById('word-warning-modal'),
  warningWordCount: document.getElementById('warning-word-count'),
  closeWarningBtn: document.getElementById('close-warning-btn'),
  newSheetFromWarningBtn: document.getElementById('new-sheet-from-warning-btn'),
  
  // Panels & Resizers
  workspace: document.querySelector('.forge-workspace'),
  resizers: document.querySelectorAll('.resizer')
};

// ===================================================================
// Sheet Management
// ===================================================================

/**
 * Create a new sheet
 */
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

/**
 * Load a sheet into the editor
 */
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
    
    updateWordCount();
    renderSheetList();
    
    // Save to localStorage for crash recovery
    localStorage.setItem('lastOpenedSheet', sheetId);
  } catch (error) {
    console.error('Error loading sheet:', error);
  }
}

/**
 * Get current sheet
 */
function getCurrentSheet() {
  return state.sheets.find(s => s.id === state.currentSheetId);
}

/**
 * Update current sheet in memory and trigger save
 */
function updateCurrentSheet() {
  const sheet = getCurrentSheet();
  if (!sheet) return;
  
  sheet.title = elements.sheetTitle.value || 'Untitled Sheet';
  sheet.content = elements.sheetEditor.innerHTML;
  sheet.updatedAt = new Date().toISOString();
  sheet.wordCount = countWords(elements.sheetEditor.textContent);
  
  debouncedSave();
}

/**
 * Debounced save function
 */
function debouncedSave() {
  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
  }
  
  updateSaveStatus('saving');
  
  state.saveTimeout = setTimeout(async () => {
    const sheet = getCurrentSheet();
    if (!sheet) return;
    
    try {
      await saveSheetToDB(sheet);
      state.lastSavedContent = sheet.content;
      updateSaveStatus('saved');
      renderSheetList(); // Update sheet list with new timestamp
    } catch (error) {
      console.error('Error saving sheet:', error);
      updateSaveStatus('error');
    }
  }, 1000);
}

/**
 * Update save status indicator
 */
function updateSaveStatus(status) {
  elements.saveStatus.className = `save-status ${status}`;
  
  switch (status) {
    case 'saving':
      elements.saveStatus.textContent = 'Saving...';
      break;
    case 'saved':
      elements.saveStatus.textContent = 'Saved';
      break;
    case 'error':
      elements.saveStatus.textContent = 'Error saving';
      break;
  }
}

// ===================================================================
// Word Counting & Limits
// ===================================================================

/**
 * Count words in text
 */
function countWords(text) {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned.length === 0 ? 0 : cleaned.split(' ').length;
}

/**
 * Update word count display
 */
function updateWordCount() {
  const text = elements.sheetEditor.textContent;
  const words = countWords(text);
  
  elements.wordCount.textContent = `${words} words`;
  elements.wordCount.className = 'word-count';
  
  if (words >= 1000) {
    elements.wordCount.classList.add('limit');
    // Auto-create new sheet at 1000 words
    if (words === 1000) {
      handleWordLimit();
    }
  } else if (words >= 900) {
    elements.wordCount.classList.add('warning');
    if (words === 900) {
      showWordWarning();
    }
  }
}

/**
 * Show word warning modal
 */
function showWordWarning() {
  const words = countWords(elements.sheetEditor.textContent);
  elements.warningWordCount.textContent = words;
  elements.wordWarningModal.classList.remove('hidden');
}

/**
 * Handle reaching 1000 word limit
 */
async function handleWordLimit() {
  // Auto-save current sheet
  const sheet = getCurrentSheet();
  if (sheet) {
    await saveSheetToDB(sheet);
  }
  
  // Create new sheet
  await createNewSheet();
}

// ===================================================================
// Navigator UI
// ===================================================================

/**
 * Render sheet list in navigator
 */
function renderSheetList() {
  elements.sheetList.innerHTML = '';
  
  if (state.sheets.length === 0) {
    elements.sheetList.innerHTML = '<li style="padding: 15px; color: var(--text-muted);">No sheets yet</li>';
    return;
  }
  
  // Sort by most recently updated
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

/**
 * Format date for display
 */
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

/**
 * Home button - reset UI
 */
function handleHomeButton() {
  // Just refresh the view, don't change content
  if (state.currentSheetId) {
    loadSheet(state.currentSheetId);
  }
}

// ===================================================================
// Panel Resizing
// ===================================================================

/**
 * Initialize panel resizing
 */
function initPanelResizing() {
  // Load saved panel widths
  const saved = localStorage.getItem('panelWidths');
  if (saved) {
    state.panelWidths = JSON.parse(saved);
    applyPanelWidths();
  }
  
  elements.resizers.forEach((resizer, index) => {
    let startX, startWidth;
    const isLeftResizer = resizer.dataset.resizer === 'left';
    
    resizer.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startWidth = is  LeftResizer ? state.panelWidths.left : state.panelWidths.right;
      
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
      
      // Save widths
      localStorage.setItem('panelWidths', JSON.stringify(state.panelWidths));
    }
  });
}

/**
 * Apply panel widths to grid
 */
function applyPanelWidths() {
  elements.workspace.style.gridTemplateColumns = 
    `${state.panelWidths.left}px var(--resizer-width) 1fr var(--resizer-width) ${state.panelWidths.right}px`;
}

// ===================================================================
// WRAP Partner
// ===================================================================

/**
 * Add message to partner panel
 */
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

/**
 * Send message to partner
 */
async function sendPartnerMessage() {
  const message = elements.partnerInput.value.trim();
  if (!message) return;
  
  // Show user message
  addPartnerMessage(message, 'user');
  elements.partnerInput.value = '';
  
  // Show thinking indicator
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
    
    // Show suggestion with apply button
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
    
    // Remove thinking indicator
    const messages = elements.partnerMessages.querySelectorAll('.partner-message');
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.textContent === 'Thinking...') {
      lastMessage.remove();
    }
    
    addPartnerMessage('Sorry, I encountered an error. Please try again.', 'system');
  }
}

/**
 * Apply suggestion to sheet at cursor position
 */
function applySuggestionToSheet(text) {
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  
  const textNode = document.createTextNode(' ' + text + ' ');
  range.insertNode(textNode);
  
  // Move cursor after inserted text
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Trigger content update
  updateCurrentSheet();
  updateWordCount();
}

// ===================================================================
// Local Revise Tools
// ===================================================================

/**
 * Rinse - Remove double spaces and normalize punctuation
 */
function rinseText() {
  let text = elements.sheetEditor.innerHTML;
  
  // Remove multiple spaces
  text = text.replace(/&nbsp;+/g, ' ');
  text = text.replace(/\s{2,}/g, ' ');
  
  // Normalize punctuation spacing
  text = text.replace(/\s+([.,!?;:])/g, '$1'); // Remove space before punctuation
  text = text.replace(/([.,!?;:])\s*/g, '$1 '); // Ensure space after punctuation
  text = text.trim();
  
  elements.sheetEditor.innerHTML = text;
  updateCurrentSheet();
  
  addPartnerMessage('Text rinsed: removed extra spaces and normalized punctuation.', 'system');
}

/**
 * Wash - Suggest paragraph breaks
 */
function washText() {
  const text = elements.sheetEditor.textContent;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length < 4) {
    addPartnerMessage('Text looks good. Consider adding more content for better paragraph suggestions.', 'system');
    return;
  }
  
  // Simple heuristic: suggest breaks every 3-4 sentences
  const suggestion = `Consider adding paragraph breaks:\n\n` +
    `• After: "${sentences[2]?.trim().substring(0, 50)}..."\n` +
    (sentences[5] ? `• After: "${sentences[5]?.trim().substring(0, 50)}..."\n` : '');
  
  addPartnerMessage(suggestion, 'system');
}

// ===================================================================
// Event Listeners
// ===================================================================

function initEventListeners() {
  // Navigator
  elements.homeBtn.addEventListener('click', handleHomeButton);
  elements.newSheetBtn.addEventListener('click', createNewSheet);
  
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
    // Initialize database
    await initDB();
    console.log('Database initialized');
    
    // Load all sheets
    state.sheets = await getAllSheetsFromDB();
    console.log(`Loaded ${state.sheets.length} sheets`);
    
    // Check for crash recovery
    const lastOpened = localStorage.getItem('lastOpenedSheet');
    
    if (state.sheets.length === 0) {
      // No sheets exist, create first one
      await createNewSheet();
    } else if (lastOpened && state.sheets.some(s => s.id === lastOpened)) {
      // Load last opened sheet
      await loadSheet(lastOpened);
    } else {
      // Load most recent sheet
      const mostRecent = state.sheets.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      await loadSheet(mostRecent.id);
    }
    
    // Render UI
    renderSheetList();
    
    // Initialize panel resizing
    initPanelResizing();
    
    // Initialize event listeners
    initEventListeners();
    
    console.log('The Forge is ready');
    
  } catch (error) {
    console.error('Initialization error:', error);
    addPartnerMessage(`Error initializing: ${error.message}`, 'system');
  }
}

// Start the application
window.addEventListener('DOMContentLoaded', init);