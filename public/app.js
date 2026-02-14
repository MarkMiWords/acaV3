/**
 * ===================================================================
 * The Sovereign Forge - Application Logic
 * VT.6.4 - Direct Regional API Connection
 * ===================================================================
 */

const FORGE_VERSION = 'VT.6.4';
console.log(`%c Sovereign Forge Logic ${FORGE_VERSION} Loading... `, 'background: #222; color: #bada55; font-size: 1.2rem;');

// Use relative path for API to work with Firebase Hosting rewrites and emulators
const API_BASE_URL = '/api';

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
    if (!db) return reject(new Error('Database not initialized'));
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(sheet);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllSheetsFromDB() {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getSheetFromDB(id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteSheetFromDB(id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));
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
  },
  isListening: false,
  voiceMode: 'partner' // 'partner', 'dictation', 'live'
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
  dictationBtn: document.getElementById('dictation-btn'),

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
  partnerMicBtn: document.getElementById('partner-mic-btn'),

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

// Helper to add event listener only if element exists
function addSafeListener(el, type, handler) {
  if (el) {
    el.addEventListener(type, handler);
  }
}

// ===================================================================
// WRAP Hub Dropdowns
// ===================================================================

function initWrapHub() {
  if (!elements.wrapHubBtns) return;
  
  elements.wrapHubBtns.forEach(btn => {
    addSafeListener(btn, 'click', (e) => {
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
  if (elements.wrapDropdowns) {
    elements.wrapDropdowns.forEach(dropdown => {
      addSafeListener(dropdown, 'click', (e) => {
        e.stopPropagation();
      });
    });
  }
}

function closeAllDropdowns() {
  if (elements.wrapDropdowns) {
    elements.wrapDropdowns.forEach(d => d.classList.remove('open'));
  }
  if (elements.wrapHubBtns) {
    elements.wrapHubBtns.forEach(b => b.classList.remove('open'));
  }
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
    addPartnerMessage(`Failed to create new sheet: ${error.message}`, 'system');
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
    if (elements.sheetTitle) elements.sheetTitle.value = sheet.title;
    if (elements.sheetEditor) elements.sheetEditor.innerHTML = sheet.content;
    state.lastSavedContent = sheet.content;

    if (elements.currentEditingTitle) {
      elements.currentEditingTitle.textContent = sheet.title || 'Untitled Sheet';
    }

    // Reset partner conversation for new sheet context
    state.partnerHistory = [];

    updateWordCount();
    renderSheetList();

    localStorage.setItem('lastOpenedSheet', sheetId);
  } catch (error) {
    console.error('Error loading sheet:', error);
    addPartnerMessage(`Error loading sheet: ${error.message}`, 'system');
  }
}

function getCurrentSheet() {
  return state.sheets.find(s => s.id === state.currentSheetId);
}

function updateCurrentSheet() {
  const sheet = getCurrentSheet();
  if (!sheet) return;

  if (elements.sheetTitle) {
    sheet.title = elements.sheetTitle.value || 'Untitled Sheet';
  }
  if (elements.sheetEditor) {
    sheet.content = elements.sheetEditor.innerHTML;
    sheet.wordCount = countWords(elements.sheetEditor.textContent);
  }
  
  sheet.updatedAt = new Date().toISOString();

  if (elements.currentEditingTitle) {
    elements.currentEditingTitle.textContent = sheet.title;
  }

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
  if (!text) return 0;
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned.length === 0 ? 0 : cleaned.split(' ').length;
}

function updateWordCount() {
  if (!elements.sheetEditor || !elements.statusWords) return;
  
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
  if (!elements.sheetEditor || !elements.wordWarningModal || !elements.warningWordCount) return;
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
  if (!elements.sheetList) return;
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
    const deleteBtn = li.querySelector('.sheet-list-item-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteSheetModal(sheet.id, sheet.title);
      });
    }

    elements.sheetList.appendChild(li);
  });
}

// ===================================================================
// Delete Sheet
// ===================================================================

let deleteSheetTargetId = null;

function showDeleteSheetModal(id, title) {
  deleteSheetTargetId = id;
  const titleText = document.getElementById('delete-sheet-title-text');
  if (titleText) titleText.textContent = title || 'Untitled Sheet';
  if (elements.deleteSheetModal) elements.deleteSheetModal.classList.remove('hidden');
}

function hideDeleteSheetModal() {
  deleteSheetTargetId = null;
  if (elements.deleteSheetModal) elements.deleteSheetModal.classList.add('hidden');
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
    addPartnerMessage(`Error deleting sheet: ${error.message}`, 'system');
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

  if (!elements.resizers) return;
  
  elements.resizers.forEach(resizer => {
    let startX, startWidth;
    const isLeftResizer = resizer.dataset.resizer === 'left';

    addSafeListener(resizer, 'mousedown', (e) => {
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
  if (elements.workspace) {
    elements.workspace.style.gridTemplateColumns =
      `${state.panelWidths.left}px var(--resizer-width) 1fr var(--resizer-width) ${state.panelWidths.right}px`;
  }
}

// ===================================================================
// WRAP Partner
// ===================================================================

function addPartnerMessage(content, type = 'assistant') {
  if (!elements.partnerMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `partner-message ${type}`;

  if (typeof content === 'string') {
    messageDiv.innerHTML = `<p>${content}</p>`;
  } else {
    messageDiv.appendChild(content);
  }

  elements.partnerMessages.appendChild(messageDiv);
  elements.partnerMessages.scrollTop = elements.partnerMessages.scrollHeight;
  return messageDiv;
}

function removeThinkingIndicator() {
  if (!elements.partnerMessages) return;
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
  if (!elements.partnerInput) return;
  const message = elements.partnerInput.value.trim();
  if (!message) return;

  addPartnerMessage(message, 'user');
  elements.partnerInput.value = '';

  // Track in conversation history
  state.partnerHistory.push({ role: 'user', text: message });

  // Reset voice accumulator if listening
  if (state.isListening) {
    finalTranscriptAccumulator = '';
    elements.partnerInput.setAttribute('data-voice-base', '');
  }

  addPartnerMessage('Thinking...', 'system');

  try {
    const url = API_BASE_URL + '/partner';
    console.log('Sending message to API:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sheetContent: elements.sheetEditor ? elements.sheetEditor.textContent : '',
        history: state.partnerHistory.slice(0, -1)
      })
    });

    // Check if response is HTML (often happens on routing errors)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
        console.error('API returned HTML instead of JSON. Check backend routing.');
        throw new Error('API routing error (returned HTML). The backend may be misconfigured or offline.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Partner request failed');
    }

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

      const applyBtn = suggestionCard.querySelector('.apply-suggestion-btn');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          applySuggestionToSheet(data.suggestion);
        });
      }

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
    addPartnerMessage(`Partner Error: ${error.message}`, 'system');

    // Remove the failed user message from history
    state.partnerHistory.pop();
  }
}

function applySuggestionToSheet(text) {
  if (!elements.sheetEditor) return;
  
  elements.sheetEditor.focus();
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(' ' + text + ' ');
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // Just append if no selection
    elements.sheetEditor.innerHTML += ' ' + text + ' ';
  }

  updateCurrentSheet();
  updateWordCount();
}

// ===================================================================
// Voice Input (Speech to Text)
// ===================================================================

let recognition = null;
let audioContext = null;
let analyser = null;
let microphoneStream = null;
let finalTranscriptAccumulator = ''; 
let restartTimer = null;
let restarting = false;

function initVoiceInput() {
  console.log('initVoiceInput explicitly called');
  if (recognition) return;

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    if (elements.partnerMicBtn) elements.partnerMicBtn.style.display = 'none';
    console.warn('Speech recognition not supported in this browser.');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true; 
  recognition.interimResults = true; 
  recognition.lang = 'en-AU';

  recognition.onstart = () => {
    console.log('Voice recognition session started');
    updateMicStatusUI(true);
    startVolumeMonitoring();
    setTimeout(() => { restarting = false; }, 500);
  };

  recognition.onend = () => {
    console.log('Voice recognition session ended. state.isListening:', state.isListening);
    if (state.isListening) {
      scheduleVoiceRestart(300);
    } else {
      updateMicStatusUI(false);
      stopVolumeMonitoring();
    }
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let sessionFinal = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        sessionFinal += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (sessionFinal) {
        finalTranscriptAccumulator += sessionFinal;
    }

    handleVoiceResult(finalTranscriptAccumulator, interimTranscript);
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (!state.isListening) return;

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopVoiceInput();
    }
  };

  // Partner Mic Button
  if (elements.partnerMicBtn) {
    elements.partnerMicBtn.onclick = (e) => {
      e.preventDefault();
      if (state.isListening && state.voiceMode === 'partner') {
        stopVoiceInput();
      } else {
        state.voiceMode = 'partner';
        startVoiceInput(elements.partnerMicBtn);
      }
    };
  }

  // Hub Dictation Button
  if (elements.dictationBtn) {
    elements.dictationBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAllDropdowns();
        if (state.isListening && state.voiceMode === 'dictation') {
            stopVoiceInput();
        } else {
            state.voiceMode = 'dictation';
            if (elements.dictationBtn) elements.dictationBtn.classList.add('active');
            startVoiceInput(null); 
            addPartnerMessage('Dictation mode active. Speak to write directly to the sheet.', 'system');
        }
    };
  }
}

async function startVolumeMonitoring() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(microphoneStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const checkVolume = () => {
            if (!state.isListening) return;
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            let average = sum / dataArray.length;
            
            // Visual trigger based on volume
            const activeSpan = document.querySelector('#status-vault span');
            if (activeSpan) {
                if (average > 5) { // Sensitivity threshold
                    activeSpan.style.textShadow = `0 0 ${average/1.5}px var(--danger)`;
                    activeSpan.style.opacity = '1';
                } else {
                    activeSpan.style.textShadow = 'none';
                    activeSpan.style.opacity = '0.7';
                }
            }
            
            requestAnimationFrame(checkVolume);
        };
        
        checkVolume();
    } catch (e) {
        console.warn('Volume monitoring failed:', e.message);
    }
}

function stopVolumeMonitoring() {
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
        audioContext = null;
    }
}

function startVoiceInput(btn) {
    console.log('Voice Start Requested. Mode:', state.voiceMode);
    state.isListening = true;
    finalTranscriptAccumulator = '';
    
    // Clear all active mic states first
    if (elements.partnerMicBtn) elements.partnerMicBtn.classList.remove('active');
    if (elements.dictationBtn) elements.dictationBtn.classList.remove('active');
    
    if (btn) btn.classList.add('active');
    if (state.voiceMode === 'dictation' && elements.dictationBtn) elements.dictationBtn.classList.add('active');
    
    if (state.voiceMode === 'partner' && elements.partnerInput) {
        elements.partnerInput.setAttribute('data-voice-base', elements.partnerInput.value);
    } else if (state.voiceMode === 'dictation' && elements.sheetEditor) {
        elements.sheetEditor.setAttribute('data-voice-base', elements.sheetEditor.innerHTML);
    } else if (state.voiceMode === 'live' && elements.sheetEditor) {
        elements.sheetEditor.setAttribute('data-voice-base', elements.sheetEditor.innerHTML);
    }

    scheduleVoiceRestart(0);
}

function stopVoiceInput() {
    console.log('Voice Stop Requested');
    state.isListening = false;
    restarting = false;
    if (restartTimer) clearTimeout(restartTimer);
    
    if (elements.partnerMicBtn) elements.partnerMicBtn.classList.remove('active');
    if (elements.dictationBtn) elements.dictationBtn.classList.remove('active');
    if (elements.liveLinkBtn) elements.liveLinkBtn.classList.remove('active');
    
    try { recognition.stop(); } catch (e) {}
    updateMicStatusUI(false);
    stopVolumeMonitoring();
    
    if (state.voiceMode === 'dictation') {
        addPartnerMessage('Dictation stopped.', 'system');
    }
}

function handleVoiceResult(final, interim) {
    if (state.voiceMode === 'partner') {
        if (!elements.partnerInput) return;
        const currentBase = elements.partnerInput.getAttribute('data-voice-base') || '';
        const combinedText = currentBase + (currentBase && !currentBase.endsWith(' ') ? ' ' : '') + final + interim;
        elements.partnerInput.value = combinedText;
        elements.partnerInput.scrollTop = elements.partnerInput.scrollHeight;
    } 
    else if (state.voiceMode === 'dictation' || state.voiceMode === 'live') {
        if (!elements.sheetEditor) return;
        const currentBase = elements.sheetEditor.getAttribute('data-voice-base') || '';
        
        const transcript = (final + interim).trim();
        if (transcript) {
            elements.sheetEditor.innerHTML = currentBase + (currentBase ? '<br><br>' : '') + '<em>' + transcript + '</em>';
            elements.sheetEditor.scrollTop = elements.sheetEditor.scrollHeight;
            updateCurrentSheet();
        }
    }
}

function scheduleVoiceRestart(delay = 250) {
  if (!recognition || !state.isListening) return;
  if (restartTimer) clearTimeout(restartTimer);

  restartTimer = setTimeout(() => {
    if (!state.isListening) return;
    if (restarting) return;

    restarting = true;
    console.log('Attempting to restart voice recognition...');

    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition start failed, scheduling retry:', e.message);
      restarting = false;
      scheduleVoiceRestart(600); 
    }
    
    setTimeout(() => { restarting = false; }, 2000);
  }, delay);
}

function updateMicStatusUI(isActive) {
    const statusVault = document.getElementById('status-vault');
    if (!statusVault) return;
    
    if (isActive) {
        statusVault.innerHTML = 'Mic: <span style="color: var(--danger); font-weight: bold; transition: all 0.1s ease;">ACTIVE</span>';
    } else {
        statusVault.innerHTML = 'Mic: OFF';
    }
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
  if (!elements.helpModeBtns) return;
  
  elements.helpModeBtns.forEach(btn => {
    addSafeListener(btn, 'click', () => {
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
  addSafeListener(elements.liveLinkBtn, 'click', () => {
    if (state.liveLinkActive) {
      // Deactivate
      state.liveLinkActive = false;
      if (elements.liveLinkBtn) elements.liveLinkBtn.classList.remove('active');
      addPartnerMessage('Live Link disconnected.', 'system');
      stopVoiceInput();
      return;
    }

    // Show guardrails
    if (elements.liveLinkModal) {
      elements.liveLinkModal.classList.remove('hidden');
    }
    if (elements.guardrailsAcceptCheck) {
      elements.guardrailsAcceptCheck.checked = false;
    }
    if (elements.initializeLiveLinkBtn) {
      elements.initializeLiveLinkBtn.disabled = true;
    }
  });

  // Checkbox enables Initialize button
  addSafeListener(elements.guardrailsAcceptCheck, 'change', () => {
    if (elements.initializeLiveLinkBtn) {
      elements.initializeLiveLinkBtn.disabled = !elements.guardrailsAcceptCheck.checked;
    }
  });

  // Initialize
  addSafeListener(elements.initializeLiveLinkBtn, 'click', () => {
    if (elements.liveLinkModal) elements.liveLinkModal.classList.add('hidden');
    state.liveLinkActive = true;
    if (elements.liveLinkBtn) elements.liveLinkBtn.classList.add('active');
    addPartnerMessage('Live Link initialized. Wrapp is listening.', 'system');
    
    state.voiceMode = 'live';
    startVoiceInput(null);
  });

  // Cancel
  addSafeListener(elements.cancelLiveLinkBtn, 'click', () => {
    if (elements.liveLinkModal) elements.liveLinkModal.classList.add('hidden');
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
  addSafeListener(elements.importTextBtn, 'click', () => {
    closeAllDropdowns();
    resetImportModal();
    if (elements.importTextModal) elements.importTextModal.classList.remove('hidden');
  });

  // File input change
  addSafeListener(elements.importFileInput, 'change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
  });

  // Drag and drop
  if (elements.importFileZone) {
    addSafeListener(elements.importFileZone, 'dragover', (e) => {
      e.preventDefault();
      elements.importFileZone.classList.add('dragover');
    });

    addSafeListener(elements.importFileZone, 'dragleave', () => {
      elements.importFileZone.classList.remove('dragover');
    });

    addSafeListener(elements.importFileZone, 'drop', (e) => {
      e.preventDefault();
      elements.importFileZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleImportFile(file);
    });
  }

  // Clear file
  addSafeListener(elements.importFileClear, 'click', () => {
    importedFileHtml = '';
    if (elements.importFileInput) elements.importFileInput.value = '';
    if (elements.importFileName) elements.importFileName.classList.add('hidden');
  });

  // Append
  addSafeListener(elements.importAppendBtn, 'click', () => {
    const html = getImportHtml();
    if (!html) return;

    if (elements.sheetEditor) {
      elements.sheetEditor.innerHTML += html;
    }
    finishImport('appended');
  });

  // Replace
  addSafeListener(elements.importReplaceBtn, 'click', () => {
    const html = getImportHtml();
    if (!html) return;

    if (elements.sheetEditor) {
      elements.sheetEditor.innerHTML = html;
    }
    finishImport('replaced');
  });

  // Cancel
  addSafeListener(elements.importCancelBtn, 'click', () => {
    if (elements.importTextModal) elements.importTextModal.classList.add('hidden');
  });
}

function resetImportModal() {
  importedFileHtml = '';
  importedFileTitle = '';
  if (elements.importTextArea) elements.importTextArea.value = '';
  if (elements.importFileInput) elements.importFileInput.value = '';
  if (elements.importFileName) elements.importFileName.classList.add('hidden');
}

/**
 * Returns HTML content from either the uploaded file or the paste area.
 * File takes priority if present.
 */
function getImportHtml() {
  // File content takes priority
  if (importedFileHtml) return importedFileHtml;

  // Fall back to paste area
  if (!elements.importTextArea) return '';
  const text = elements.importTextArea.value.trim();
  if (!text) return '';

  // Convert plain text to paragraphs
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function finishImport(action) {
  // Apply extracted H1 as sheet title if present
  if (importedFileTitle) {
    if (elements.sheetTitle) elements.sheetTitle.value = importedFileTitle;
    if (elements.currentEditingTitle) elements.currentEditingTitle.textContent = importedFileTitle;
  }

  updateCurrentSheet();
  updateWordCount();
  if (elements.importTextModal) elements.importTextModal.classList.add('hidden');

  const words = elements.sheetEditor ? countWords(elements.sheetEditor.textContent) : 0;
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
  if (elements.importFileNameText) elements.importFileNameText.textContent = file.name;
  if (elements.importFileName) elements.importFileName.classList.remove('hidden');

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
      if (elements.importFileName) elements.importFileName.classList.add('hidden');
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
    if (elements.importFileName) elements.importFileName.classList.add('hidden');
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
  if (!elements.sheetEditor) return;
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
  if (!elements.sheetEditor) return;
  const text = elements.sheetEditor.textContent;
  if (countWords(text) < 10) {
    addPartnerMessage('Write a bit more before washing — there\'s not enough to work with yet.', 'system');
    return;
  }
  closeAllDropdowns();
  await runReviseTool('wash');
}

async function scrubText() {
  if (!elements.sheetEditor) return;
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
    const response = await fetch(API_BASE_URL + '/revise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetContent: elements.sheetEditor ? elements.sheetEditor.textContent : '',
        tool
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Revise request failed');
    }

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
    addPartnerMessage(`Revise Error: ${error.message}`, 'system');
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
  addSafeListener(elements.newSheetBtn, 'click', createNewSheet);

  // Home button resets to most recent sheet
  addSafeListener(elements.homeBtn, 'click', () => {
    if (state.sheets.length > 0) {
      const mostRecent = [...state.sheets].sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      loadSheet(mostRecent.id);
    }
    if (elements.sheetEditor) elements.sheetEditor.focus();
  });

  // Save to Vault
  addSafeListener(elements.saveToVaultBtn, 'click', async () => {
    const sheet = getCurrentSheet();
    if (sheet) {
      try {
        await saveSheetToDB(sheet);
        addPartnerMessage('Sheet saved to Vault.', 'system');
      } catch (err) {
        addPartnerMessage(`Failed to save: ${err.message}`, 'system');
      }
    }
  });

  // Sheet Editor
  addSafeListener(elements.sheetTitle, 'input', updateCurrentSheet);
  addSafeListener(elements.sheetEditor, 'input', () => {
    updateCurrentSheet();
    updateWordCount();
  });

  // Revise Tools
  addSafeListener(elements.rinseBtn, 'click', rinseText);
  addSafeListener(elements.washBtn, 'click', washText);
  addSafeListener(elements.scrubBtn, 'click', scrubText);

  // WRAP Partner
  addSafeListener(elements.partnerSendBtn, 'click', sendPartnerMessage);
  addSafeListener(elements.partnerInput, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPartnerMessage();
    }
  });

  // Word Warning Modal
  addSafeListener(elements.closeWarningBtn, 'click', () => {
    if (elements.wordWarningModal) elements.wordWarningModal.classList.add('hidden');
  });

  addSafeListener(elements.newSheetFromWarningBtn, 'click', async () => {
    if (elements.wordWarningModal) elements.wordWarningModal.classList.add('hidden');
    await createNewSheet();
  });

  // Delete Sheet Modal
  addSafeListener(elements.confirmDeleteSheetBtn, 'click', confirmDeleteSheet);
  addSafeListener(elements.cancelDeleteSheetBtn, 'click', hideDeleteSheetModal);
}

// ===================================================================
// Initialization
// ===================================================================

async function init() {
  console.log('Initializing The Sovereign Forge...');
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
      const sorted = [...state.sheets].sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      if (sorted.length > 0) {
        await loadSheet(sorted[0].id);
      } else {
        await createNewSheet();
      }
    }

    renderSheetList();
    initPanelResizing();
    initWrapHub();
    initHelpModes();
    initLiveLink();
    initImportText();
    initEventListeners();
    initVoiceInput();
    
    // UI Sync: Ensure brand version is correct
    const brandVer = document.querySelector('.brand-version');
    if (brandVer) brandVer.textContent = FORGE_VERSION;

    console.log(`The Sovereign Forge ${FORGE_VERSION} is ready`);

  } catch (error) {
    console.error('Initialization error:', error);
    addPartnerMessage(`Initialization Error: ${error.message}`, 'system');
  }
}

window.addEventListener('DOMContentLoaded', init);
