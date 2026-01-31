# A Captive Audience – Forge (v2)

**Status:** Pre-Alpha / Foundations Build  
**Audience:** Formerly incarcerated, accessibility-challenged, legally-challenged, and financially-challenged writers

## What This Is

A Captive Audience is a writing and publishing initiative built to help people tell their stories on their own terms.

The Forge is a lightweight, local-first writing application designed for users who are often excluded from mainstream creative tools due to cost, complexity, bandwidth requirements, or life circumstance.

**This is not a “general AI chatbot.”**  
It is a purpose-built writing tool.

## Core Principles

- **Voice Sovereignty:** The writer’s voice comes first. AI assists with structure and revision, not authorship.
- **Local-First Reliability:** Writing is saved locally in the browser (IndexedDB). Work should never be lost due to dropped connections, refreshes, or limited internet access.
- **Low Bandwidth, Low Friction:** No heavy frameworks, no build steps, no unnecessary dependencies. The app is designed to work on older devices and constrained networks.
- **Privacy by Default:** Users begin anonymously and write under a pseudonym. Identity is protected unless the user explicitly chooses otherwise.
- **Explicit AI Use:** AI is only invoked when the user asks for it. There are no background calls, hidden analysis, or passive token usage.

## The Forge

The Forge is organised around a simple three-pane workspace:

- **Sidebar** – Manage writing sheets
- **Editor** – The primary writing surface
- **Chat / Tools** – A writing partner for feedback and revision

## WRAP Workflow

- **Write** – Free writing, file import, and dictation (future)
- **Revise** – Graduated editing tools:
  - Rinse (light cleanup)
  - Wash (structure and clarity)
  - Scrub (tightening and refinement)
- **Articulate** – Voice and tone tools (future)
- **Publish** – Formatting and export tools (future)

## Technology Overview

**Frontend:**
- Plain HTML, CSS, and Vanilla JavaScript (no frameworks)

**Backend:**
- Firebase Cloud Functions v2 (TypeScript) running an Express API

**Persistence:**
- IndexedDB (local-first). Cloud sync is planned but not required for operation.

**AI Integration:**
- Backend-only. No API keys or model access in the client.

**Hosting:**
- Firebase Hosting with SPA routing and local emulator support.

## Development Philosophy

This project is intentionally conservative in its technical choices.

- Complexity is treated as a cost.
- Features must justify their existence by helping someone finish a piece of writing.
- If a feature increases token usage, infrastructure dependence, or cognitive load without clear benefit to the writer, it does not belong in the Forge.

---

## Quick Start

**Prerequisites:**
- Node.js (18 LTS recommended)
- Firebase CLI

**Install Firebase CLI:**

**Local URLs:**
- App (Hosting Emulator): http://localhost:5000
- Functions Emulator: http://localhost:5001

All frontend API calls go through `/api/*` and are proxied by Firebase Hosting.

---

## Current State

This repository represents the foundational layer only:

- Wiring
- Persistence
- Routing
- Guardrails

It is intentionally boring.

That is by design.