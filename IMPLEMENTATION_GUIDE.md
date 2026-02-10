# Forge Implementation Guide

## ROLE: Senior Software Architect

You are not designing features.
You are implementing a scaffold that must strictly follow an existing system contract.

You must read the file `forge-blueprint.md` in the project root and treat it as a binding specification.

---

## Important Constraints

1. **The application is NOT a chatbot.**

2. **The Sheet is the primary object.**

3. **The WRAP Partner must never write directly into the Sheet.**

4. **The app must function local-first before any AI integration.**

5. **All AI interaction goes through the backend only.**

6. **No frameworks** (no React, no Vite, no SPA routers).
   Use plain HTML, CSS, and vanilla JS.

The goal is a working Forge workspace layout and storage system, not AI behaviour yet.

---

## Your Task

Build the initial Forge scaffold implementing ONLY the following systems:

### 1. Workspace Layout

Create a three-panel layout:

- **Left:** Navigator
- **Center:** Sheet editor
- **Right:** WRAP Partner panel

**Requirements:**

- CSS Grid layout
- Resizable panel dividers
- Width persistence using localStorage
- Mobile fallback to slide panels

### 2. Sheet System

Implement the Sheet as the primary object.

**Features:**

- contenteditable writing area
- autosave every second (debounced)
- IndexedDB storage
- crash recovery
- load last opened sheet on startup
- new sheet creation
- 1000-word limit with soft warning at 900 words

**No AI, no formatting logic yet.**

### 3. Navigator

Implement:

- new sheet button
- sheet list (title + last edited)
- switching sheets
- home button (UI reset only)

**No Vault or Cloud storage yet.**

### 4. WRAP Partner Panel

Create a placeholder partner panel.

It must:

- display messages
- accept user input
- **NEVER write to the Sheet**
- show suggestion cards with an "Apply to Sheet" button

The Apply button inserts text at cursor position only after user confirmation.

### 5. Revise Tools (Local Only)

Implement local tools:

**Rinse:**
- remove double spaces
- normalize punctuation spacing

**Wash:**
- suggest paragraph breaks

**Scrub:**
- placeholder only

**No AI calls.**

### 6. Backend Stub

Create a Firebase Functions v2 Express server with:

- `GET /health`
- `POST /partner` (returns mock suggestion text)

No Gemini integration yet.

All requests must go through `/api/*` routing.

### 7. Persistence Rules

- All writing stored locally first
- No login
- No accounts
- No external database yet

---

## Deliverables

Generate the full project file structure and code needed to run locally with Firebase emulators.

The result should allow a user to:
**open the Forge → type → refresh → writing is still there.**

---

## What NOT to Implement Yet

- Publishing features
- AI generation
- Live Link
- Vault/Cloud storage
- User accounts
- Voice features
- PII Guard

This is a **scaffold phase** focused on the core workspace and local persistence.
