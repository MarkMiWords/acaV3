// IndexedDB wrapper and app logic for ACA v2

const DB_NAME = "aca_v2";
const DB_VERSION = 1;
let db;

// Utility: Promisified IndexedDB open
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function (e) {
      db = e.target.result;
      if (!db.objectStoreNames.contains("sheets")) {
        db.createObjectStore("sheets", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ui_state")) {
        db.createObjectStore("ui_state", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("author_profile")) {
        db.createObjectStore("author_profile", { keyPath: "key" });
      }
    };
    req.onsuccess = function (e) {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = function (e) {
      reject(e.target.error);
    };
  });
}

// Utility: Promisified transaction
function tx(store, mode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

// Sheets CRUD
function getSheets() {
  return new Promise((resolve, reject) => {
    const sheets = [];
    const req = tx("sheets").openCursor();
    req.onsuccess = function (e) {
      const cursor = e.target.result;
      if (cursor) {
        sheets.push(cursor.value);
        cursor.continue();
      } else {
        resolve(sheets);
      }
    };
    req.onerror = reject;
  });
}

function getSheet(id) {
  return new Promise((resolve, reject) => {
    const req = tx("sheets").get(id);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

function putSheet(sheet) {
  return new Promise((resolve, reject) => {
    const req = tx("sheets", "readwrite").put(sheet);
    req.onsuccess = () => resolve();
    req.onerror = reject;
  });
}

function deleteSheet(id) {
  return new Promise((resolve, reject) => {
    const req = tx("sheets", "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = reject;
  });
}

// UI State
function getUIState(key) {
  return new Promise((resolve, reject) => {
    const req = tx("ui_state").get(key);
    req.onsuccess = e => resolve(e.target.result ? e.target.result.value : null);
    req.onerror = reject;
  });
}

function setUIState(key, value) {
  return new Promise((resolve, reject) => {
    const req = tx("ui_state", "readwrite").put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = reject;
  });
}

// Author Profile
function getAuthorProfile() {
  return new Promise((resolve, reject) => {
    const req = tx("author_profile").get("pseudonym");
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

function setAuthorProfile(pseudonym) {
  return new Promise((resolve, reject) => {
    const req = tx("author_profile", "readwrite").put({
      key: "pseudonym",
      value: pseudonym,
      createdAt: Date.now()
    });
    req.onsuccess = () => resolve();
    req.onerror = reject;
  });
}

// Pseudonym generation
function generatePseudonyms() {
  const names = [
    "Echo Lantern", "Nova Quill", "Jade Cipher", "Vesper Rune", "Orion Shade",
    "Lyra Vale", "Cinder Fox", "Atlas Reed", "Sable Finch", "Indigo Wren",
    "Zephyr Moss", "Rune Ember", "Solace Drift", "Bram Willow", "Fable Ash"
  ];
  // Shuffle and pick 10
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, 10);
}

// UI Elements
const onboardingModal = document.getElementById("onboarding-modal");
const pseudonymList = document.getElementById("pseudonym-list");
const rerollBtn = document.getElementById("reroll-pseudonyms");
const sheetList = document.getElementById("sheet-list");
const newSheetBtn = document.getElementById("new-sheet");
const sheetTitleInput = document.getElementById("sheet-title");
const sheetContentInput = document.getElementById("sheet-content");
const revisionBtns = document.querySelectorAll(".revise-btn");
const applyRevisionBtn = document.getElementById("apply-revision");
const revisionNotesDiv = document.getElementById("revision-notes");
const chatHistoryDiv = document.getElementById("chat-history");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const connectionStatusDiv = document.getElementById("connection-status");

let currentSheetId = null;
let revisionMode = null;
let lastRevision = null;
let autosaveTimer = null;
let autosaveInterval = null;
let connectionLost = false;

// Onboarding modal logic
function showOnboarding(pseudonyms) {
  onboardingModal.classList.remove("hidden");
  pseudonymList.innerHTML = "";
  pseudonyms.forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    li.onclick = () => {
      pseudonymList.querySelectorAll("li").forEach(el => el.classList.remove("selected"));
      li.classList.add("selected");
      setAuthorProfile(name).then(() => {
        onboardingModal.classList.add("hidden");
        loadApp();
      });
    };
    pseudonymList.appendChild(li);
  });
}

rerollBtn.onclick = () => {
  showOnboarding(generatePseudonyms());
};

// Sheet list logic
function renderSheetList(sheets) {
  sheetList.innerHTML = "";
  sheets.forEach(sheet => {
    const li = document.createElement("li");
    li.textContent = sheet.title || "Untitled";
    li.className = sheet.id === currentSheetId ? "selected" : "";
    li.onclick = () => {
      saveCurrentSheet().then(() => {
        loadSheet(sheet.id);
      });
    };
    sheetList.appendChild(li);
  });
}

// Load sheet into editor
function loadSheet(id) {
  getSheet(id).then(sheet => {
    if (!sheet) return;
    currentSheetId = id;
    sheetTitleInput.value = sheet.title || "";
    sheetContentInput.value = sheet.content || "";
    setUIState("lastSheetId", id);
    getSheets().then(renderSheetList);
  });
}

// Save current sheet
function saveCurrentSheet() {
  if (!currentSheetId) return Promise.resolve();
  const title = sheetTitleInput.value;
  const content = sheetContentInput.value;
  return putSheet({
    id: currentSheetId,
    title,
    content,
    updatedAt: Date.now(),
    createdAt: Date.now()
  });
}

// Autosave logic
function debounceSave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveCurrentSheet, 1000);
}

function startAutosaveInterval() {
  if (autosaveInterval) clearInterval(autosaveInterval);
  autosaveInterval = setInterval(saveCurrentSheet, 15000);
}

window.addEventListener("beforeunload", () => {
  saveCurrentSheet();
});

// Revision logic
revisionBtns.forEach(btn => {
  btn.onclick = () => {
    revisionMode = btn.getAttribute("data-mode");
    fetch("/api/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetText: sheetContentInput.value,
        mode: revisionMode
      })
    })
      .then(resp => resp.json())
      .then(data => {
        if (data.revisedText) {
          lastRevision = data.revisedText;
          revisionNotesDiv.textContent = (data.changeNotes || []).join("\n");
        } else if (data.moderation && !data.moderation.allowed) {
          revisionNotesDiv.textContent = data.moderation.reason;
        }
      })
      .catch(() => {
        revisionNotesDiv.textContent = "Connection lost. Working offline.";
        connectionLost = true;
        connectionStatusDiv.classList.remove("hidden");
      });
  };
});

applyRevisionBtn.onclick = () => {
  if (lastRevision) {
    sheetContentInput.value = lastRevision;
    saveCurrentSheet();
    lastRevision = null;
    revisionNotesDiv.textContent = "";
  }
};

// Chat logic
chatForm.onsubmit = function (e) {
  e.preventDefault();
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;
  appendChat("user", userMessage);
  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetText: sheetContentInput.value,
      userMessage,
      mode: "chat"
    })
  })
    .then(resp => resp.json())
    .then(data => {
      if (data.assistantMessage) {
        appendChat("assistant", data.assistantMessage);
      } else if (data.moderation && !data.moderation.allowed) {
        appendChat("system", data.moderation.reason);
      }
      chatInput.value = "";
    })
    .catch(() => {
      appendChat("system", "Connection lost. Working offline.");
      connectionLost = true;
      connectionStatusDiv.classList.remove("hidden");
    });
};

function appendChat(role, message) {
  const div = document.createElement("div");
  div.className = "chat-msg " + role;
  div.textContent = message;
  chatHistoryDiv.appendChild(div);
  chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}

// Sheet title/content events
sheetTitleInput.oninput = debounceSave;
sheetContentInput.oninput = debounceSave;

// New sheet
newSheetBtn.onclick = () => {
  const id = "sheet_" + Date.now();
  const sheet = {
    id,
    title: "Untitled",
    content: "",
    updatedAt: Date.now(),
    createdAt: Date.now()
  };
  putSheet(sheet).then(() => {
    currentSheetId = id;
    loadSheet(id);
    getSheets().then(renderSheetList);
  });
};

// App startup
function loadApp() {
  getAuthorProfile().then(profile => {
    if (!profile) {
      showOnboarding(generatePseudonyms());
      return;
    }
    getSheets().then(sheets => {
      if (sheets.length === 0) {
        // Create default sheet
        const id = "sheet_" + Date.now();
        const sheet = {
          id,
          title: "Untitled",
          content: "",
          updatedAt: Date.now(),
          createdAt: Date.now()
        };
        putSheet(sheet).then(() => {
          currentSheetId = id;
          loadSheet(id);
          getSheets().then(renderSheetList);
        });
      } else {
        getUIState("lastSheetId").then(lastId => {
          const id = lastId || sheets[sheets.length - 1].id;
          currentSheetId = id;
          loadSheet(id);
          renderSheetList(sheets);
        });
      }
    });
  });
}

// Connection resilience
window.addEventListener("online", () => {
  connectionLost = false;
  connectionStatusDiv.classList.add("hidden");
});
window.addEventListener("offline", () => {
  connectionLost = true;
  connectionStatusDiv.classList.remove("hidden");
});

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// Init
openDB().then(loadApp);