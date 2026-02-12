/**
 * ===================================================================
 * The Vault - Sheet Archive
 * ACA V3 - Browse, search, preview, and manage all sheets
 * ===================================================================
 */

const DB_NAME = 'ForgeDB';
const DB_VERSION = 1;
const STORE_NAME = 'sheets';

let db = null;
let allSheets = [];
let deleteTargetId = null;

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
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

function getAllSheets() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteSheet(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===================================================================
// Rendering
// ===================================================================

function renderVault(sheets) {
  const grid = document.getElementById('vault-grid');
  const empty = document.getElementById('vault-empty');
  const noResults = document.getElementById('vault-no-results');

  grid.innerHTML = '';

  // Update stats
  document.getElementById('vault-total-sheets').textContent =
    `${allSheets.length} sheet${allSheets.length !== 1 ? 's' : ''}`;
  document.getElementById('vault-total-words').textContent =
    `${allSheets.reduce((sum, s) => sum + (s.wordCount || 0), 0)} total words`;

  if (allSheets.length === 0) {
    empty.classList.remove('hidden');
    noResults.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');

  if (sheets.length === 0) {
    noResults.classList.remove('hidden');
    return;
  }

  noResults.classList.add('hidden');

  sheets.forEach(sheet => {
    const card = document.createElement('div');
    card.className = 'vault-card';

    // Extract plain text preview
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sheet.content || '';
    const plainText = tempDiv.textContent || '';
    const preview = plainText.substring(0, 180).trim();

    card.innerHTML = `
      <div class="vault-card-header">
        <h3 class="vault-card-title">${escapeHtml(sheet.title || 'Untitled Sheet')}</h3>
        <button class="vault-card-delete" data-id="${sheet.id}" title="Delete sheet">&times;</button>
      </div>
      <p class="vault-card-preview">${preview ? escapeHtml(preview) + '...' : 'Empty sheet'}</p>
      <div class="vault-card-meta">
        <span>${sheet.wordCount || 0} words</span>
        <span>${formatDate(sheet.updatedAt)}</span>
      </div>
      <div class="vault-card-actions">
        <a href="/?sheet=${sheet.id}" class="vault-card-open">Open in Forge</a>
      </div>
    `;

    // Delete button
    card.querySelector('.vault-card-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteModal(sheet.id, sheet.title);
    });

    grid.appendChild(card);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// ===================================================================
// Search & Sort
// ===================================================================

function getFilteredSheets() {
  const query = document.getElementById('vault-search').value.toLowerCase().trim();
  const sortValue = document.getElementById('vault-sort').value;

  let filtered = [...allSheets];

  // Filter
  if (query) {
    filtered = filtered.filter(s => {
      const titleMatch = (s.title || '').toLowerCase().includes(query);
      // Extract plain text from content for search
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = s.content || '';
      const contentMatch = tempDiv.textContent.toLowerCase().includes(query);
      return titleMatch || contentMatch;
    });
  }

  // Sort
  switch (sortValue) {
    case 'updated-desc':
      filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      break;
    case 'updated-asc':
      filtered.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
      break;
    case 'created-desc':
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'created-asc':
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case 'title-asc':
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'title-desc':
      filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      break;
    case 'words-desc':
      filtered.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
      break;
    case 'words-asc':
      filtered.sort((a, b) => (a.wordCount || 0) - (b.wordCount || 0));
      break;
  }

  return filtered;
}

function refreshVault() {
  renderVault(getFilteredSheets());
}

// ===================================================================
// Delete Modal
// ===================================================================

function showDeleteModal(id, title) {
  deleteTargetId = id;
  document.getElementById('delete-sheet-title').textContent = title || 'Untitled Sheet';
  document.getElementById('vault-delete-modal').classList.remove('hidden');
}

function hideDeleteModal() {
  deleteTargetId = null;
  document.getElementById('vault-delete-modal').classList.add('hidden');
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
// Init
// ===================================================================

async function initVault() {
  loadTheme();

  try {
    await initDB();
    allSheets = await getAllSheets();
    refreshVault();
  } catch (error) {
    console.error('Vault init error:', error);
  }

  // Search
  document.getElementById('vault-search').addEventListener('input', refreshVault);

  // Sort
  document.getElementById('vault-sort').addEventListener('change', refreshVault);

  // Delete confirm
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await deleteSheet(deleteTargetId);
      allSheets = allSheets.filter(s => s.id !== deleteTargetId);

      // Clear lastOpenedSheet if we deleted it
      if (localStorage.getItem('lastOpenedSheet') === deleteTargetId) {
        localStorage.removeItem('lastOpenedSheet');
      }

      hideDeleteModal();
      refreshVault();
    } catch (error) {
      console.error('Delete error:', error);
    }
  });

  // Delete cancel
  document.getElementById('cancel-delete-btn').addEventListener('click', hideDeleteModal);
}

window.addEventListener('DOMContentLoaded', initVault);
