/**
 * 商业版法律文档：退款政策、可接受使用政策，以及替换用户协议「计费」一节的文案。
 * 支付网关（Creem 等）审核要求站点公开这两份政策。正式上线前请由法务审阅。
 */
import type { LegalDoc, LegalSection } from './legalContent'

export type PolicySlug = 'refund' | 'acceptable-use'

const UPDATED = '2026-11-23'

const ZH: Record<PolicySlug, LegalDoc> = {
  refund: {
    slug: 'refund',
    title: '退款政策',
    updatedAt: UPDATED,
    intro:
      '本政策说明 credit 包与订阅的退款规则。国际银行卡付款由 Creem 作为记录商户（Merchant of Record）代收，退款也经由 Creem 原路退回。',
    sections: [
      {
        title: '1. 生成失败自动退还',
        paragraphs: [
          '每个生成任务开始时只预扣估算额度，结束后按实际用量结算。任务失败、被取消或上游未产出结果时，预扣的 credit 会自动退回钱包，无需申请。',
        ],
      },
      {
        title: '2. credit 包',
        bullets: [
          '购买后 14 天内、且该笔 credit 未被使用的，可申请全额退款。',
          '已部分使用的，按未使用比例退款；首充赠送的 credit 不计入可退金额，退款时一并扣回。',
          '超过 14 天的 credit 包不予退款，但 credit 永久有效、可继续使用。',
        ],
      },
      {
        title: '3. 订阅',
        bullets: [
          '可随时在「管理订阅」中取消，取消后在当前计费周期结束时停止续费，本期月额度可用到期末。',
          '首次订阅 7 天内且当月额度使用不超过 20% 的，可申请全额退款；退款后订阅立即终止，剩余月额度作废。',
          '续费周期一般不退款；因我们的服务故障导致长时间无法使用的，可联系我们按天折算补偿。',
          '升级套餐按比例补差价，降级在下一期生效，均不产生退款。',
        ],
      },
      {
        title: '4. 不予退款的情形',
        bullets: [
          '因违反《可接受使用政策》被限制或注销的账号。',
          '对生成结果的主观不满意（AI 输出具有随机性，请先用低分辨率预览确认效果）。',
          '已发起信用卡拒付（chargeback）的订单；拒付期间账号可能被冻结。',
        ],
      },
      {
        title: '5. 如何申请',
        paragraphs: [
          '请通过「联系我们」提交注册邮箱、订单号与退款原因。我们会在 3 个工作日内回复，审核通过后款项按原支付方式退回，到账时间取决于发卡行（通常 5–10 个工作日）。',
        ],
      },
    ],
  },
  'acceptable-use': {
    slug: 'acceptable-use',
    title: '可接受使用政策',
    updatedAt: UPDATED,
    intro: '为保护用户、第三方与支付合作方，使用本平台生成或上传内容时必须遵守以下规则。违反者我们有权删除内容、限制功能或注销账号，且不予退款。',
    sections: [
      {
        title: '1. 严格禁止',
        bullets: [
          '任何涉及未成年人的性化内容，一经发现立即注销并依法上报。',
          '未经本人同意的真人深度伪造、换脸，或真人的私密 / 色情影像。',
          '冒充他人或机构、伪造新闻与公文、用于诈骗或误导选举的内容。',
          '鼓吹暴力、恐怖主义、自残，或针对种族、宗教、性别、性取向等的仇恨内容。',
          '露骨色情内容。',
          '侵犯他人著作权、商标权、肖像权或隐私的内容。',
        ],
      },
      {
        title: '2. 平台滥用',
        bullets: [
          '批量注册账号套取赠送额度，或共享 / 转售账号与 API Key。',
          '绕过、探测或攻击内容审核与计费系统，或对服务进行压力测试。',
          '用自动化脚本以超出正常使用的频率调用接口（开放 API 按文档限额使用）。',
        ],
      },
      {
        title: '3. 使用真人素材',
        paragraphs: [
          '上传或生成可识别真人的内容时，您必须已获得当事人授权；用于商业用途时须确保授权范围覆盖该用途。我们可能要求您提供授权证明。',
        ],
      },
      {
        title: '4. 执行与申诉',
        bullets: [
          '我们结合自动审核与人工复核处理违规内容，并可能保留相关记录以配合执法。',
          '情节轻微的会先警告；严重或重复违规直接注销账号。',
          '如认为处理有误，可通过「联系我们」申诉，我们会在 5 个工作日内答复。',
        ],
      },
      {
        title: '5. 举报',
        paragraphs: ['发现违规内容请通过「联系我们」举报，并附上链接或截图。'],
      },
    ],
  },
}

const EN: Record<PolicySlug, LegalDoc> = {
  refund: {
    slug: 'refund',
    title: 'Refund Policy',
    updatedAt: UPDATED,
    intro:
      'This policy explains refunds for credit packs and subscriptions. Card payments are processed by Creem as Merchant of Record, and refunds go back through Creem to the original payment method.',
    sections: [
      {
        title: '1. Failed generations are refunded automatically',
        paragraphs: [
          'Each generation only reserves an estimate when it starts and is settled on actual usage when it ends. If a task fails, is cancelled, or the upstream model returns nothing, the reserved credits go back to your wallet automatically. No request needed.',
        ],
      },
      {
        title: '2. Credit packs',
        bullets: [
          'Unused credit packs can be fully refunded within 14 days of purchase.',
          'Partly used packs are refunded pro rata for the unused part. First top-up bonus credits are not refundable and are removed on refund.',
          'Packs older than 14 days are not refundable, but credits never expire and stay usable.',
        ],
      },
      {
        title: '3. Subscriptions',
        bullets: [
          'Cancel anytime from “Manage subscription”. Renewal stops at the end of the current period and this period’s monthly credits stay usable until then.',
          'First-time subscriptions can be fully refunded within 7 days if no more than 20% of that month’s credits were used. The subscription ends immediately and remaining monthly credits are voided.',
          'Renewals are generally not refunded. If an outage on our side makes the service unusable for an extended time, contact us for a prorated credit.',
          'Upgrades are charged pro rata and downgrades take effect next period. Neither creates a refund.',
        ],
      },
      {
        title: '4. Not refundable',
        bullets: [
          'Accounts restricted or closed for breaching the Acceptable Use Policy.',
          'Dissatisfaction with creative results (AI output is non-deterministic; preview at low resolution first).',
          'Orders under a chargeback. The account may be frozen while the dispute is open.',
        ],
      },
      {
        title: '5. How to request',
        paragraphs: [
          'Contact us with your account email, order number and reason. We reply within 3 business days. Approved refunds go back to the original payment method; arrival depends on your card issuer (usually 5–10 business days).',
        ],
      },
    ],
  },
  'acceptable-use': {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    updatedAt: UPDATED,
    intro:
      'To protect users, third parties and our payment partners, everything you generate or upload must follow these rules. We may remove content, restrict features or close accounts that break them, without refund.',
    sections: [
      {
        title: '1. Strictly prohibited',
        bullets: [
          'Any sexualised content involving minors. Accounts are closed immediately and reported to authorities.',
          'Deepfakes or face swaps of real people without their consent, or intimate / sexual imagery of real people.',
          'Impersonating people or organisations, fake news or documents, fraud, or election disinformation.',
          'Promotion of violence, terrorism or self-harm, or hate targeting race, religion, gender, sexual orientation and similar traits.',
          'Sexually explicit content.',
          'Content infringing copyright, trademarks, likeness or privacy rights.',
        ],
      },
      {
        title: '2. Platform abuse',
        bullets: [
          'Mass sign-ups to farm free credits, or sharing / reselling accounts and API keys.',
          'Bypassing, probing or attacking moderation or billing, or load-testing the service.',
          'Automated calls beyond normal use (the public API must stay within its documented limits).',
        ],
      },
      {
        title: '3. Real-person material',
        paragraphs: [
          'If you upload or generate content showing an identifiable real person, you must have their permission, and for commercial use the permission must cover that use. We may ask for proof.',
        ],
      },
      {
        title: '4. Enforcement and appeals',
        bullets: [
          'We combine automated and human review and may keep records to cooperate with law enforcement.',
          'Minor issues get a warning first; serious or repeated violations lead to account closure.',
          'If you think we got it wrong, appeal via Contact us and we will answer within 5 business days.',
        ],
      },
      {
        title: '5. Reporting',
        paragraphs: ['Report violating content via Contact us with a link or screenshot.'],
      },
    ],
  },
}

const VI: Record<PolicySlug, LegalDoc> = {
  refund: {
    slug: 'refund',
    title: 'Chính sách hoàn tiền',
    updatedAt: UPDATED,
    intro:
      'Chính sách này áp dụng cho gói credit và gói thuê bao. Thanh toán bằng thẻ quốc tế do Creem xử lý với tư cách Merchant of Record; tiền hoàn cũng đi qua Creem về đúng phương thức đã thanh toán.',
    sections: [
      {
        title: '1. Tác vụ lỗi được hoàn tự động',
        paragraphs: [
          'Mỗi tác vụ chỉ tạm giữ một khoản ước tính khi bắt đầu và được quyết toán theo mức dùng thực tế khi kết thúc. Nếu tác vụ lỗi, bị huỷ hoặc mô hình không trả kết quả, credit tạm giữ tự quay về ví, bạn không cần yêu cầu.',
        ],
      },
      {
        title: '2. Gói credit',
        bullets: [
          'Gói chưa dùng được hoàn toàn bộ trong vòng 14 ngày kể từ khi mua.',
          'Gói đã dùng một phần được hoàn theo tỷ lệ phần chưa dùng. Credit thưởng nạp lần đầu không được hoàn và sẽ bị thu lại khi hoàn tiền.',
          'Gói quá 14 ngày không được hoàn, nhưng credit không bao giờ hết hạn và vẫn dùng được.',
        ],
      },
      {
        title: '3. Thuê bao',
        bullets: [
          'Huỷ bất cứ lúc nào trong mục “Quản lý thuê bao”. Thuê bao dừng gia hạn vào cuối kỳ hiện tại, credit tháng của kỳ này vẫn dùng được tới hết kỳ.',
          'Lần đăng ký đầu tiên được hoàn toàn bộ trong 7 ngày nếu chưa dùng quá 20% credit của tháng đó. Thuê bao kết thúc ngay và credit tháng còn lại bị huỷ.',
          'Các kỳ gia hạn thường không được hoàn. Nếu sự cố từ phía chúng tôi khiến dịch vụ không dùng được trong thời gian dài, hãy liên hệ để được bù theo ngày.',
          'Nâng gói được tính chênh lệch theo tỷ lệ, hạ gói có hiệu lực từ kỳ sau; cả hai đều không phát sinh hoàn tiền.',
        ],
      },
      {
        title: '4. Không hoàn tiền',
        bullets: [
          'Tài khoản bị hạn chế hoặc khoá do vi phạm Chính sách sử dụng.',
          'Không hài lòng về mặt sáng tạo với kết quả (AI cho kết quả ngẫu nhiên, hãy xem trước ở độ phân giải thấp).',
          'Đơn hàng đang bị khiếu nại hoàn tiền với ngân hàng (chargeback); tài khoản có thể bị tạm khoá trong thời gian này.',
        ],
      },
      {
        title: '5. Cách yêu cầu',
        paragraphs: [
          'Gửi qua trang Liên hệ kèm email tài khoản, mã đơn hàng và lý do. Chúng tôi trả lời trong 3 ngày làm việc. Khoản hoàn được duyệt sẽ về đúng phương thức thanh toán ban đầu; thời gian nhận tiền tuỳ ngân hàng phát hành thẻ (thường 5–10 ngày làm việc).',
        ],
      },
    ],
  },
  'acceptable-use': {
    slug: 'acceptable-use',
    title: 'Chính sách sử dụng',
    updatedAt: UPDATED,
    intro:
      'Để bảo vệ người dùng, bên thứ ba và đối tác thanh toán, mọi nội dung bạn tạo hoặc tải lên phải tuân thủ các quy định dưới đây. Chúng tôi có quyền gỡ nội dung, hạn chế tính năng hoặc khoá tài khoản vi phạm mà không hoàn tiền.',
    sections: [
      {
        title: '1. Nghiêm cấm',
        bullets: [
          'Mọi nội dung tình dục hoá liên quan tới trẻ vị thành niên. Tài khoản bị khoá ngay và báo cho cơ quan chức năng.',
          'Deepfake hoặc ghép mặt người thật khi chưa có sự đồng ý, hoặc hình ảnh riêng tư / khiêu dâm của người thật.',
          'Mạo danh cá nhân hoặc tổ chức, tin giả, giấy tờ giả, lừa đảo, hoặc thông tin sai lệch về bầu cử.',
          'Cổ xuý bạo lực, khủng bố, tự hại, hoặc thù ghét nhắm vào chủng tộc, tôn giáo, giới tính, xu hướng tính dục và các đặc điểm tương tự.',
          'Nội dung khiêu dâm.',
          'Nội dung xâm phạm bản quyền, nhãn hiệu, quyền hình ảnh hoặc quyền riêng tư.',
        ],
      },
      {
        title: '2. Lạm dụng nền tảng',
        bullets: [
          'Tạo hàng loạt tài khoản để lấy credit miễn phí, hoặc chia sẻ / bán lại tài khoản và API Key.',
          'Lách, dò quét hay tấn công hệ thống kiểm duyệt hoặc tính phí, hoặc thử tải dịch vụ.',
          'Gọi tự động vượt mức sử dụng bình thường (API công khai phải dùng trong giới hạn ghi trong tài liệu).',
        ],
      },
      {
        title: '3. Dùng hình ảnh người thật',
        paragraphs: [
          'Khi tải lên hoặc tạo nội dung có người thật nhận diện được, bạn phải có sự cho phép của người đó; nếu dùng cho mục đích thương mại, sự cho phép phải bao gồm mục đích ấy. Chúng tôi có thể yêu cầu bằng chứng.',
        ],
      },
      {
        title: '4. Xử lý và khiếu nại',
        bullets: [
          'Chúng tôi kết hợp kiểm duyệt tự động và người duyệt, và có thể lưu hồ sơ để phối hợp với cơ quan chức năng.',
          'Vi phạm nhẹ sẽ được cảnh báo trước; vi phạm nghiêm trọng hoặc lặp lại sẽ bị khoá tài khoản.',
          'Nếu cho rằng chúng tôi xử lý sai, hãy khiếu nại qua trang Liên hệ; chúng tôi trả lời trong 5 ngày làm việc.',
        ],
      },
      {
        title: '5. Báo cáo vi phạm',
        paragraphs: ['Báo cáo nội dung vi phạm qua trang Liên hệ, kèm đường dẫn hoặc ảnh chụp màn hình.'],
      },
    ],
  },
}

/** 按界面语言取退款 / 可接受使用政策 */
export function getPolicyDoc(slug: PolicySlug, locale: string): LegalDoc {
  const pack = locale === 'en' ? EN : locale === 'vi' ? VI : ZH
  return pack[slug]
}

/** 商业版「计费」条款：替换开源版用户协议第 4 节（原文写的是成本价、支付宝 / 微信、无订阅） */
const BILLING_SECTION: Record<'zh' | 'en' | 'vi', LegalSection> = {
  zh: {
    title: '4. 计费、订阅与退款',
    bullets: [
      '生成任务按模型与规格消耗 credit，价格在提交前展示；开始时预扣估算额度，结束后按实际用量多退少补。',
      '单买的 credit 永久有效；订阅的月额度当期有效，期末未用完即过期，扣费时优先消耗月额度。',
      '订阅按月或按年自动续费，可随时取消，取消后在当期结束时停止续费。',
      '国际银行卡付款由 Creem 作为记录商户代收并开具发票。',
      '退款规则见《退款政策》。',
    ],
  },
  en: {
    title: '4. Billing, subscriptions and refunds',
    bullets: [
      'Generations consume credits depending on the model and settings; the price is shown before you submit. An estimate is reserved when a task starts and settled on actual usage when it ends.',
      'Purchased credits never expire. Subscription credits are valid for the current period, expire at its end, and are used before purchased credits.',
      'Subscriptions renew automatically each month or year and can be cancelled anytime; renewal stops at the end of the current period.',
      'Card payments are collected and invoiced by Creem as Merchant of Record.',
      'Refunds follow the Refund Policy.',
    ],
  },
  vi: {
    title: '4. Tính phí, thuê bao và hoàn tiền',
    bullets: [
      'Mỗi tác vụ tiêu tốn credit tuỳ mô hình và cấu hình; giá được hiển thị trước khi bạn gửi. Khi bắt đầu, hệ thống tạm giữ một khoản ước tính và quyết toán theo mức dùng thực tế khi kết thúc.',
      'Credit mua lẻ không bao giờ hết hạn. Credit thuê bao chỉ có hiệu lực trong kỳ hiện tại, hết hạn cuối kỳ và được trừ trước credit mua lẻ.',
      'Thuê bao tự gia hạn theo tháng hoặc năm và huỷ được bất cứ lúc nào; việc gia hạn dừng vào cuối kỳ hiện tại.',
      'Thanh toán bằng thẻ quốc tế do Creem thu và xuất hoá đơn với tư cách Merchant of Record.',
      'Việc hoàn tiền tuân theo Chính sách hoàn tiền.',
    ],
  },
}

/** 用户协议换上商业版计费条款（按标题前缀「4.」定位） */
export function withCommercialBilling(doc: LegalDoc, locale: string): LegalDoc {
  const key = locale === 'en' || locale === 'vi' ? locale : 'zh'
  return {
    ...doc,
    sections: doc.sections.map((sec) => (sec.title.trim().startsWith('4.') ? BILLING_SECTION[key] : sec)),
  }
}
