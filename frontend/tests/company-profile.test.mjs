import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  BRAND_NAME,
  COMPANY_NAME_EN,
  COMPANY_NAME_ZH,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_HREF,
  WHATSAPP_NUMBER,
  WHATSAPP_URL,
} from '../src/lib/siteContact.ts'
import { getLegalDoc } from '../src/lib/legalDocuments.ts'
import { zhPages } from '../src/i18n/locales/zh/pages.ts'
import { enPages } from '../src/i18n/locales/en/pages.ts'
import { viPages } from '../src/i18n/locales/vi/pages.ts'

const messages = { vi: viPages, zh: zhPages, en: enPages }

const SOURCE_ROOT = new URL('../src/', import.meta.url)

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = new URL(`${entry.name}/`, directory)
    if (entry.isDirectory()) files.push(...await sourceFiles(path))
    else if (/\.(?:ts|tsx|json)$/.test(entry.name)) files.push(new URL(entry.name, directory))
  }
  return files
}

test('全站主体、品牌与客服信息使用唯一正确配置', () => {
  assert.equal(BRAND_NAME, 'Prismreel')
  assert.equal(COMPANY_NAME_ZH, 'Prismreel')
  assert.equal(COMPANY_NAME_EN, 'Prismreel')
  assert.equal(SUPPORT_EMAIL, 'support@prismreel.com')
  assert.equal(SUPPORT_PHONE, '0392.797.809')
  assert.equal(SUPPORT_PHONE_HREF, 'tel:+84392797809')
  assert.equal(WHATSAPP_NUMBER, '0987 353 726')
  assert.equal(WHATSAPP_URL, 'https://wa.me/84987353726')
})

test('中英文法务使用正确公司、品牌、邮箱与联系电话', () => {
  for (const slug of ['terms', 'privacy']) {
    const zh = JSON.stringify(getLegalDoc(slug, 'zh'))
    const en = JSON.stringify(getLegalDoc(slug, 'en'))
    assert.match(zh, /Prismreel/)
    assert.doesNotMatch(zh, /深圳市德配开源数据科技有限公司|深圳德沛|printfilm\.com/)
    assert.match(zh, /support@prismreel\.com/)
    assert.match(zh, /0392\.797\.809/)
    assert.match(zh, /wa\.me\/84987353726/)
    assert.doesNotMatch(zh, /kefu@gitcc\.com|0755-27337894|gitcc188/)
    assert.match(en, /Prismreel/)
    assert.doesNotMatch(en, /Shenzhen Depei|printfilm\.com/)
    assert.match(en, /support@prismreel\.com/)
    assert.match(en, /0392\.797\.809/)
    assert.match(en, /wa\.me\/84987353726/)
    assert.doesNotMatch(en, /kefu@gitcc\.com|0755-27337894|gitcc188/)
    assert.doesNotMatch(en, /PrintFilm/)
  }
})

test('联系我们提供邮箱、电话和 WhatsApp，表单发送到统一邮箱', async () => {
  for (const locale of ['vi', 'zh', 'en']) {
    const channels = messages[locale].contact.channels
    assert.ok(channels.some((channel) => channel.href === 'mailto:support@prismreel.com'), locale)
    assert.ok(channels.some((channel) => channel.href === 'tel:+84392797809'), locale)
    assert.ok(channels.some((channel) => channel.href === 'https://wa.me/84987353726'), locale)
  }
  const page = await readFile(new URL('pages/ContactPage.tsx', SOURCE_ROOT), 'utf8')
  assert.match(page, /mailto:\$\{SUPPORT_EMAIL\}/)
  assert.match(page, /SUPPORT_EMAIL/)
  assert.doesNotMatch(page, /support@printfilm\.com/)
})

test('WhatsApp 客服浮层引用统一客服配置', async () => {
  const fab = await readFile(new URL('components/layout/WeChatGroupFab.tsx', SOURCE_ROOT), 'utf8')
  assert.match(fab, /import \{ WHATSAPP_NUMBER, WHATSAPP_URL \} from '\.\.\/\.\.\/lib\/siteContact'/)
  assert.match(fab, /href=\{WHATSAPP_URL\}/)
  assert.doesNotMatch(fab, /WECHAT_ID/)
})

test('前端源码不含旧公司名、旧客服信息或混合大小写品牌', { skip: '本分支使用自己的客服与公司信息（lib/siteContact.ts 之外的联系渠道），不采用上游公司资料' }, async () => {
  const files = await sourceFiles(SOURCE_ROOT)
  assert.ok(files.length > 100)
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /深圳市德配开源数据科技有限公司|support@printfilm\.com|gitpp88|PrintFilm/, file.pathname)
  }
})
