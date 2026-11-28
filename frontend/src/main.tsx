import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider, installLocaleHeader } from './i18n'
import { installErrorReporter } from './lib/errorReporter'
import { captureReferral } from './lib/referral'
import { formatMoney } from './lib/money'
import { setPointFormatter } from './lib/points'
import './index.css'
// 暗色主题文字兜底：为写死深色文字的规则补亮色（scripts/gen_dark_text_css.py 生成）
import './styles/darkText.generated.css'

// 所有后端请求带 X-Locale（后端按界面语言返回报错与内容）
installLocaleHeader()
// 线上运行时错误上报到 /api/error-reports
installErrorReporter()
// 合作伙伴推广码（?ref=）
captureReferral()

// 上游「积分」显示统一换成本分支钱包币种金额
setPointFormatter((value) => formatMoney(value))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
