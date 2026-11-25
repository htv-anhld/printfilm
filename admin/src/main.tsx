import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { I18nProvider, installLocaleHeader } from "./i18n";
import { loadBillingCurrency, money } from "./lib/money";
import { setPointFormatter } from "./lib/points";
import "./index.css";
import "./styles/admin-console.css";
import "./styles/admin-forms.css";

// 所有 /api/ 请求自动带 X-Locale
installLocaleHeader();

// 上游「积分」显示统一换成本分支钱包币种金额
setPointFormatter((value) => money(value));

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
