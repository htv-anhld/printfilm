import type { Plugin } from 'vite'

/**
 * SEO 构建插件：
 * - index.html 里的 __SITE_URL__ 替换为 VITE_SITE_URL（canonical / og:url / hreflang / JSON-LD）
 * - 构建时生成 robots.txt 与 sitemap.xml（应用内页面一律 Disallow，对齐 Dravelio）
 *
 * 同一份构建同时服务 www.<域名>（可索引）与 app.<域名>（noindex，由 index.html 内联脚本按主机名判断）。
 */

// 可被收录的公开页面
const PUBLIC_PATHS = ['/', '/pricing', '/method', '/templates', '/tools', '/help', '/terms', '/privacy', '/refund', '/acceptable-use', '/contact', '/partners']

// 登录后应用页：不收录。注意不能写 /assets：那是 Vite 的 JS/CSS 产物目录，挡掉后爬虫无法渲染
const DISALLOW = ['/studio', '/drama', '/wallet', '/settings', '/history', '/auth', '/api/']

const LOCALES = ['vi', 'en', 'zh']

function siteUrl(): string {
  return (process.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
}

export function robotsTxt(base: string): string {
  return ['User-agent: *', ...DISALLOW.map((p) => `Disallow: ${p}`), 'Allow: /', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n')
}

export function sitemapXml(base: string, today: string): string {
  const urls = PUBLIC_PATHS.map((path) => {
    const loc = `${base}${path}`
    const alternates = LOCALES.map(
      (lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${loc}${path.includes('?') ? '&' : '?'}lang=${lang}" />`,
    ).join('\n')
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n${alternates}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />\n  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`
}

export default function seoPlugin(): Plugin {
  return {
    name: 'printfilm-seo',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', siteUrl())
    },
    generateBundle() {
      const base = siteUrl()
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(base) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(base, today) })
    },
  }
}
