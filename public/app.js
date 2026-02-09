'''
// =================================================================================
// DOM Element References
// =================================================================================
const sheetList = document.getElementById('sheet-list');
const newSheetBtn = document.getElementById('new-sheet');
const sheetTitle = document.getElementById('sheet-title');
const sheetContent = document.getElementById('sheet-content');
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const connectionStatus = document.getElementById('connection-status');
const pseudonymModal = document.getElementById('pseudonym-modal');
const pseudonymList = document.getElementById('pseudonym-list');
const rerollPseudonymsBtn = document.getElementById('reroll-pseudonyms');


// =================================================================================
// Application State
// =================================================================================
let state = {
  sheets: [],
  activeSheetId: null,
  pseudonym: null,
};

const newSheetTemplate = {
  id: '',
  title: 'Untitled',
  content: '',
  createdAt: '',
  updatedAt: '',
};


// =================================================================================
// Local Storage
// =================================================================================
const STORAGE_KEY = 'acaV3_TheForge_state';

function saveState() {
  try {
    const data = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, data);
    console.log("State saved.");
  } catch (error) {
    console.error("Failed to save state:", error);
    connectionStatus.textContent = "Error: Could not save data to local storage.";
  }
}

function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      state = JSON.parse(data);
      console.log("State loaded.");
    }
  } catch (error) {
    console.error("Failed to load state:", error);
    connectionStatus.textContent = "Error: Could not load data from local storage.";
  }
}


// =================================================================================
// UI Rendering Functions
// =================================================================================

/**
 * Renders the list of sheets in the sidebar.
 */
function renderSheetList() {
  sheetList.innerHTML = ''; // Clear existing list
  if (state.sheets.length === 0) {
    sheetList.innerHTML = '<li>No sheets yet.</li>';
    return;
  }

  state.sheets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  state.sheets.forEach(sheet => {
    const li = document.createElement('li');
    li.textContent = sheet.title;
    li.dataset.sheetId = sheet.id;
    if (sheet.id === state.activeSheetId) {
      li.classList.add('selected');
    }
    sheetList.appendChild(li);
  });
}

/**
 * Renders the content of the currently active sheet in the editor.
 */
function renderActiveSheet() {
  const activeSheet = state.sheets.find(s => s.id === state.activeSheetId);
  if (activeSheet) {
    sheetTitle.value = activeSheet.title;
    sheetContent.value = activeSheet.content;
  } else {
    sheetTitle.value = '';
    sheetContent.value = '';
    sheetTitle.disabled = true;
    sheetContent.disabled = true;
  }
}

// =================================================================================
// API / Chat Functions
// =================================================================================
/**
 * Appends a message to the chat history UI.
 * @param {string} sender 'user', 'ai', or 'system'
 * @param {string} message The message content.
 * @param {string} type 'text' or 'error'.
 * @returns {HTMLElement} The paragraph element added to the chat.
 */
function appendChatMessage(sender, message, type = 'text') {
  const p = document.createElement('p');
  
  let senderPrefix = '';
  if (sender === 'user') {
    senderPrefix = '<strong>You:</strong> ';
  } else if (sender === 'ai') {
    senderPrefix = '<strong>AI:</strong> ';
  }

  p.innerHTML = senderPrefix + message.replace(/\n/g, '<br>');
  
  if (type === 'error') {
    p.style.color = 'var(--error)';
  } else if (sender === 'system') {
    p.style.fontStyle = 'italic';
  }
  
  chatHistory.appendChild(p);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return p;
}


/**
 * Handles the submission of the chat form.
 * @param {Event} e The form submission event.
 */
async function handleChatSubmit(e) {
  e.preventDefault();
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  appendChatMessage('user', userMessage);
  chatInput.value = '';
  chatInput.disabled = true;
  const thinkingMessage = appendChatMessage('system', 'Thinking...');

  const activeSheet = state.sheets.find(s => s.id === state.activeSheetId);
  const sheetText = activeSheet ? activeSheet.content : '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage, sheetText }),
    });
    
    thinkingMessage.remove();

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || `API Error (${res.status})`);
    }

    const data = await res.json();
    appendChatMessage('ai', data.response);

  } catch (err) {
    console.error('Chat error:', err);
    if(thinkingMessage) thinkingMessage.remove();
    appendChatMessage('system', `Error: ${err.message}`, 'error');
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
}


// =================================================================================
// Core Application Logic
// =================================================================================

/**
 * Switches the active sheet.
 * @param {string} sheetId The ID of the sheet to activate.
 */
function selectSheet(sheetId) {
  if (sheetId === state.activeSheetId) return;

  state.activeSheetId = sheetId;
  console.log(`Switched to sheet: ${sheetId}`);
  
  renderActiveSheet();
  renderSheetList(); // Re-render to update the 'selected' class
  saveState();
}

/**
 * Creates a new sheet and makes it active.
 */
function createNewSheet() {
  const now = new Date();
  const newSheet = {
    ...newSheetTemplate,
    id: `sheet_${now.getTime()}`,
    title: `Sheet ${state.sheets.length + 1}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  state.sheets.push(newSheet);
  selectSheet(newSheet.id); // This will render and save
  console.log("New sheet created.");
}

/**
 * Updates the active sheet's title.
 * @param {string} newTitle The new title.
 */
function updateSheetTitle(newTitle) {
    const activeSheet = state.sheets.find(s => s.id === state.activeSheetId);
    if(activeSheet) {
        activeSheet.title = newTitle;
        activeSheet.updatedAt = new Date().toISOString();
        renderSheetList(); // Update the title in the sidebar
        saveState();
    }
}

/**
 * Updates the active sheet's content.
 * @param {string} newContent The new content.
 */
function updateSheetContent(newContent) {
    const activeSheet = state.sheets.find(s => s.id === state.activeSheetId);
    if(activeSheet) {
        activeSheet.content = newContent;
        activeSheet.updatedAt = new Date().toISOString();
        saveState();
    }
}


// =================================================================================
// Event Listeners
// =================================================================================

/**
 * Handles clicks within the sheet list to switch sheets.
 * @param {Event} e The click event.
 */
function handleSheetListClick(e) {
  if (e.target && e.target.matches('li[data-sheet-id]')) {
    const sheetId = e.target.dataset.sheetId;
    selectSheet(sheetId);
  }
}

/**
 * Initializes the application.
 */
function init() {
  console.log("Initializing The Forge...");
  loadState();

  if (state.sheets.length === 0) {
    console.log("No sheets found, creating a default one.");
    createNewSheet();
  } else {
    // Ensure an active sheet is selected
    if (!state.activeSheetId || !state.sheets.some(s => s.id === state.activeSheetId)) {
      // Default to the most recently updated sheet
      state.sheets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      state.activeSheetId = state.sheets[0].id;
    }
    renderSheetList();
    renderActiveSheet();
  }

  // Add event listeners
  newSheetBtn.addEventListener('click', createNewSheet);
  sheetList.addEventListener('click', handleSheetListClick);
  sheetTitle.addEventListener('input', (e) => updateSheetTitle(e.target.value));
  sheetContent.addEventListener('input', (e) => updateSheetContent(e.target.value));
  chatForm.addEventListener('submit', handleChatSubmit);


  console.log("The Forge is ready.");
}


// =================================================================================
// Application Entry Point
// =================================================================================
window.addEventListener('DOMContentLoaded', init);
'''