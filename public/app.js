// TEMP: Firebase API health smoke test
window.addEventListener("DOMContentLoaded", () => {
  fetch("/api/health")
    .then(res => res.json())
    .then(data => {
      console.log("Health check:", data);

      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = JSON.stringify(data, null, 2);
      }
    })
    .catch(err => {
      console.error("Health check error:", err);

      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = "Error: " + err.message;
      }
    });
});
