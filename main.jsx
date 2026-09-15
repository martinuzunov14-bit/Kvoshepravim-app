import React from "react";
import ReactDOM from "react-dom/client";

function showFatalError(err) {
  const root = document.getElementById("root");
  const message = (err && err.message) || String(err) || "(няма съобщение)";
  const stack = (err && err.stack) || "";
  root.innerHTML = `
    <div style="min-height:100vh;background:#0a0a10;color:#f3f2f7;font-family:sans-serif;padding:24px;box-sizing:border-box;">
      <div style="font-size:28px;margin-bottom:10px;">⚠️</div>
      <div style="font-weight:700;margin-bottom:10px;">Грешка при зареждане</div>
      <div style="font-size:14px;color:#ff9a3d;background:#1c1c2e;padding:12px;border-radius:8px;margin-bottom:10px;font-weight:700;">${message}</div>
      <pre style="white-space:pre-wrap;font-size:10px;color:#888;background:#1c1c2e;padding:12px;border-radius:8px;">${stack}</pre>
    </div>
  `;
}

window.addEventListener("error", (e) => showFatalError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showFatalError(e.reason));

import("./App.jsx")
  .then((mod) => {
    const App = mod.default;
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((err) => showFatalError(err));
