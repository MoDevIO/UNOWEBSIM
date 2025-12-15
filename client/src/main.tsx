import './lib/monaco-error-suppressor'; // Geändert von @/lib/...
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);