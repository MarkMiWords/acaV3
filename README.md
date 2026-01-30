<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ACaptiveAudience.net v2</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="onboarding-modal" class="modal hidden">
    <div class="modal-content">
      <h2>Pick Your Pseudonym</h2>
      <ul id="pseudonym-list"></ul>
      <button id="reroll-pseudonyms">Reroll</button>
    </div>
  </div>
  <div class="container">
    <aside class="sidebar">
      <h3>Sheets</h3>
      <ul id="sheet-list"></ul>
      <button id="new-sheet">New Sheet</button>
    </aside>
    <main class="editor-pane">
      <input id="sheet-title" type="text" placeholder="Sheet Title">
      <textarea id="sheet-content" placeholder="Start writing..."></textarea>
      <div class="revision-buttons">
        <button data-mode="rinse" class="revise-btn">Rinse</button>
        <button data-mode="wash" class="revise-btn">Wash</button>
        <button data-mode="scrub" class="revise-btn">Scrub</button>
        <button id="apply-revision">Apply</button>
      </div>
      <div id="revision-notes"></div>
    </main>
    <section class="chat-pane">
      <div id="chat-history"></div>
      <form id="chat-form">
        <input id="chat-input" type="text" placeholder="Say something..." autocomplete="off">
        <button type="submit">Send</button>
      </form>
      <div id="connection-status" class="hidden">Connection lost. Working offline.</div>
    </section>
  </div>
  <script src="app.js"></script>
</body>
</html>