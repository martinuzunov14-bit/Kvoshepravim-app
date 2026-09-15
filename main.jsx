import React from "react";
import ReactDOM from "react-dom/client";

function showFatalError(err) {
  const root = document.getElementById("root");
  root.innerHTML = `
    <div style="min-height:100vh;background:#0a0a10;color:#f3f2f7;font-family:sans-serif;padding:24px;box-sizing:border-box;">
      <div style="font-size:28px;margin-bottom:10px;">⚠️</div>
      <div style="font-weight:700;margin-bottom:10px;">Грешка при зареждане</div>
      <pre style="white-space:pre-wrap;font-size:12px;color:#ff9a3d;background:#1c1c2e;padding:12px;border-radius:8px;">${String(err && (err.stack || err.message || err))}</pre>
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
