import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider, installLocaleHeader } from './i18n'
import { installErrorReporter } from './lib/errorReporter'
import { captureReferral } from './lib/referral'
import './index.css'

// 所有后端请求带 X-Locale（后端按界面语言返回报错与内容）
installLocaleHeader()
// 线上运行时错误上报到 /api/error-reports
installErrorReporter()
// 合作伙伴推广码（?ref=）
captureReferral()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
