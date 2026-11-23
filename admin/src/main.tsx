import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { I18nProvider, installLocaleHeader } from "./i18n";
import "./index.css";

// 所有 /api/ 请求自动带 X-Locale
installLocaleHeader();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
