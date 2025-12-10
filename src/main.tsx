import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Handle GitHub Pages SPA redirect
const params = new URLSearchParams(window.location.search);
const redirect = params.get('redirect');
if (redirect) {
  window.history.replaceState(null, '', decodeURIComponent(redirect));
}

createRoot(document.getElementById("root")!).render(<App />);
