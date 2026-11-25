import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { I18nProvider, installLocaleHeader } from "./i18n";
import { loadBillingCurrency } from "./lib/money";
import "./index.css";

// 所有 /api/ 请求自动带 X-Locale
installLocaleHeader();

// 先拿到计费币种再渲染（金额符号不闪），最多等 1.5 秒
void Promise.race([loadBillingCurrency(), new Promise((resolve) => setTimeout(resolve, 1500))]).finally(() =>
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
  ),
);
