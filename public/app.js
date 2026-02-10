// Firebase API health check
window.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  
  fetch("/api/health")
    .then(res => res.json())
    .then(data => {
      console.log("Health check:", data);
      
      if (statusEl) {
        statusEl.textContent = JSON.stringify(data, null, 2);
        statusEl.classList.add("status-ok");
      }
    })
    .catch(err => {
      console.error("Health check error:", err);
      
      if (statusEl) {
        statusEl.textContent = "Error: " + err.message;
        statusEl.classList.add("status-error");
      }
    });
});