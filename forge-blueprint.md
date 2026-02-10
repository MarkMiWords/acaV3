# The Sovereign Forge — System Blueprint (ACA V3)

---

## 1. Core Purpose

The Forge is a **local-first writing workspace** designed to transform spoken memory or typed experience into structured written pages and publishable stories.

The Forge is **not** a chatbot, therapy system, or social platform.

The Sheet is the primary product.
The WRAP Partner is a guided writing tool that assists the author in expressing their own words.

Every feature must either:

* produce writing
* improve writing
* prepare writing for publication

If a feature does not result in writing on the Sheet or improvement of writing, it does not belong in the Forge.

---

## 2. Foundational Principle

**The author owns the words.**

The system:

* never silently rewrites text
* never removes content without confirmation
* never replaces authorship
* never hides edits

AI suggestions must always be visible and reversible.

**WRAP Partner output must never be inserted directly into the Sheet.**
Partner suggestions appear in the WRAP Partner panel and are only added to the Sheet when the author explicitly applies them.

---

## 3. Workspace Layout

The Forge consists of three panels:

**Left Panel — Navigator**
Document management and session control.

**Center Panel — Sheet**
Primary writing surface and main focus of the application.

**Right Panel — WRAP Partner**
Guided writing assistance and suggestions.

### Resizable Panels

The internal borders between panels are adjustable by the user.

* Left and Right panels can be stretched or shrunk
* The Sheet always expands to occupy remaining space
* Panel widths persist locally per user session
* Double-clicking a divider restores default layout

Minimum widths prevent panel collapse.

Mobile devices use slide-in panels instead of resizing.

---

## 4. The Sheet

The Sheet is the primary writing object.

### Sheet Characteristics

* Local-first storage (IndexedDB)
* Persistent and recoverable
* Always editable
* Functions offline

### Sheet Rules

* Maximum length: ~1000 words
* At 900 words: gentle "wrap up" prompt
* At 1000 words: seamless new sheet created
* Previous sheet remains accessible

**One Sheet represents one narrative moment or scene.**

### Autosave

* Continuous background saving
* Crash recovery
* No manual save required

---

## 5. WRAP Hub

WRAP is the working engine of the Forge.

W → Write (Capture)
R → Revise (Improve)
A → Articulate (Express)
P → Publish (Produce)

---

## 6. WRITE (Capture)

Purpose: bring words into the Sheet.

Write never alters existing text.

### Functions

* Type directly into sheet
* Import Text (paste/upload)
* Import Sheet (duplicate existing sheet into workspace)
* Dictation (speech → text transcription only)
* Poetry Mode (preserve line breaks, minimal structure intervention)

### Dictation

Pure transcription:

* no agent interaction
* no prompting
* no rewriting

---

## 7. REVISE (Improve)

Purpose: help the author clarify writing while preserving voice.

### Rinse

Surface clean:

* spacing
* punctuation suggestions
* typo highlights

### Wash

Clarity improvement:

* paragraph suggestions
* readability suggestions
* repetition detection

### Scrub

Structural suggestions:

* order suggestions
* transition suggestions
* trimming suggestions

### Rinse & Wipe

Restores original author wording and removes accepted AI revision suggestions.

Rules:

* always show before/after
* user accepts changes
* never overwrite automatically

---

## 8. ARTICULATE (Express)

Purpose: help the author hear and shape their words.

### WRAP Partner

A guided writing assistant, not a conversational companion.

The Partner:

* asks clarifying questions
* helps expression
* supports narrative flow

The Partner does NOT:

* write full stories
* provide therapy
* replace authorship

All Partner output appears only in the WRAP Partner panel.
The Sheet contains only the author's words unless the author explicitly applies a suggestion.

### Help Modes

* Get Started (elicits memory)
* Make a Heading
* Research a Topic (context explanation)
* Guided Composition
* Turn Sheets into Stories (structuring guidance)

### Read Aloud

* playback of text
* voice, speed, and accent adjustable

### Voice Clone (optional novelty)

* user reads 45-second script
* playback uses cloned voice
* used only for reading the author's own text

---

## 9. LIVE LINK (Guided Oral Drafting)

Live Link is guided storytelling, not conversation.

Author speech → appears on Sheet
Agent speech → appears only in WRAP Partner panel

Agent speaks only to:

* clarify narrative
* prompt continuation
* maintain story flow

### Modes

* Listening Mode (spoken prompts)
* Reading Mode (text prompts)
* "Shoosh" button switches to text-only prompts

### Behaviour

* 3-second processing delay
* pauses on silence
* auto session pause after inactivity

---

## 10. PUBLISH (Produce)

Transforms sheets into artifacts.

### Outputs

* Prison Newspaper Article
* Substack Story
* Book Manuscript
* Letter
* Voice Transcript

### Mastering Actions

* ordering sheets
* suggesting transitions
* formatting
* compiling manuscript

Rules:

* no silent rewriting
* author reviews before export

---

## 11. Identity Protection (PII Guard)

Before publishing or export:

System detects:

* personal names
* identifiable locations

Author chooses:

* replace with pseudonym
* generalize location
* ignore

Consistent pseudonyms are maintained across sheets.

---

## 12. Navigator

Left panel workspace manager.

### Functions

* Home (UI reset only)
* Live Link button (state indicator)
* * New WRAP Sheet
* Sheet list (title, word count, last edited)
* Save to Vault

---

## 13. Vault

Intentional storage layer.

### Unfinished Stories

* drafts
* 30-day retention
* 5-day warning before deletion

### Finished Stories

* permanent storage

"Save to Vault" archives active sheets as finished work.

---

## 14. WRAP Profile

Controls author identity and partner behaviour.

### Author Identity

* pseudonym (default generated)

### WRAP Partner Settings

* name
* temperament (timid → firebrand)
* playback voice
* accent
* pace

### UI

* theme selection
* session reset ("Synchronize Profile & Identity")

---

## 15. Safety Boundaries

The Forge is:

* a writing workspace
* a narrative tool

The Forge is not:

* a therapist
* a social network
* a messaging system
* a roleplay AI

The WRAP Partner serves the story, not the user.

---

## 16. System Pipeline

Memory → Sheet → Collection → Mastering → Artifact

Speech or experience becomes:
written pages → structured stories → publishable output.

---

**Definition:**
The Forge is a writing workspace where speech or memory becomes structured pages, and pages become publishable stories.
