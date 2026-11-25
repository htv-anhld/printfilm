// 与上游合并时新增的文案（自动生成后可手工整理进各命名空间）
export const zhExtra = {
  "common": {
    "pagination": {
      "perPageAria": "每页显示条数",
      "nav": "分页导航",
      "pageN": "第 {n} 页"
    },
    "dateRange": {
      "label": "日期范围",
      "start": "开始日期",
      "end": "结束日期",
      "to": "至"
    },
    "userSearch": {
      "matching": "匹配用户",
      "find": "查找用户",
      "count": "{n} 位",
      "listLabel": "搜索用户",
      "failed": "搜索失败，请重新输入后重试",
      "hint": "输入邮箱、昵称或账号 ID 搜索",
      "select": "选择"
    },
    "secret": {
      "statusClearPending": "保存后清除",
      "statusDraft": "新凭证待保存",
      "statusNotConfigured": "未配置",
      "onlySpaces": "凭证不能只包含空格。",
      "guideClearPending": "当前只是标记清除，保存后生效；可撤销清除。",
      "guideNew": "填写新凭证后保存；显示按钮仅展示本次输入。",
      "markedClear": "已标记清除",
      "hideLabel": "隐藏新{label}",
      "showLabel": "显示新{label}",
      "hideInput": "隐藏本次输入",
      "showInput": "显示本次输入",
      "undo": "撤销"
    }
  },
  "labels": {
    "payType": {
      "stripe": "银行卡 · Stripe"
    }
  },
  "settings": {
    "saveBar": {
      "saveCurrent": "保存当前设置",
      "savingSettings": "正在保存设置…",
      "saveSection": "保存当前分区",
      "hint": "本页修改将在保存成功后生效。"
    },
    "oss": {
      "marketplaceNote": "数字资产市场固定使用 marketplace/ 目录，不受下方目录设置影响；市场文件以私有权限上传，通过短时签名访问。Bucket 须为私有，此页保存配置不会自动修改 Bucket 权限。"
    },
    "runtime": {
      "form": {
        "defaultsTitle": "生成默认值",
        "defaultsDesc": "设置新生成任务的默认画质、画幅和时长；具体支持范围仍由所选模型决定。",
        "imageSizeHint": "沿用上游支持的尺寸，例如 2K 或 1024x1024。",
        "videoQualityHint": "例如 480p、720p；以当前模型支持值为准。",
        "videoRatioHint": "宽:高，例如 16:9 或 9:16。",
        "egValue": "例如 {v}",
        "seedanceMinHint": "不小于 1 秒，与最大时长一起限制单段生成时长。",
        "seedanceMaxHint": "不小于最小时长；最终仍受模型时长范围限制。",
        "unitSec": "秒",
        "unitItem": "个",
        "unitLane": "路",
        "unitTimes": "次",
        "errSeconds": "请输入大于 0 的秒数",
        "errMinOne": "请输入不小于 1 的整数",
        "errInteger": "请输入整数",
        "errMaxLtMin": "最大时长不能小于最小时长",
        "errTimeout": "超时应大于轮询间隔",
        "errRequired": "请填写默认值",
        "saveLabel": "保存运行设置",
        "concTitle": "任务并发",
        "concDesc": "控制同时执行的任务数量，以及单个用户可占用的资源。",
        "globalSlotsHint": "全站可同时运行的 Worker 任务数，不小于 1。",
        "userSlotsHint": "单个用户可占用的任务数，仍受全站槽位约束。",
        "dramaVideoLimitHint": "限制排队与处理中的视频任务总数，不小于 1。",
        "draftPrefix": "当前草稿：全站",
        "draftMid": "个执行槽位，单用户最多",
        "draftSuffix": " 个；等待上游轮询的任务不占 Worker 槽位。",
        "advTitle": "高级运行参数",
        "advDesc": "管线分配、轮询与模拟模式",
        "pipelineTitle": "生成管线",
        "pipelineDesc": "分别控制各类媒体任务的并行处理数；均为不小于 1 的整数。",
        "imageConcHint": "同时处理的图像任务数。",
        "videoConcHint": "同时处理的视频任务数。",
        "ttsConcHint": "同时处理的配音任务数。",
        "pollTitle": "上游轮询与重试",
        "pollDesc": "在查询频率和等待时长之间取得平衡；超时应大于查询间隔。",
        "pollIntervalHint": "大于 0 秒；间隔越短，上游查询频率越高。",
        "pollTimeoutHint": "大于轮询间隔；超过此时长后结束等待。",
        "selectorConcHint": "Selector 每轮非阻塞查询的最大路数，不小于 1。",
        "fragmentAttemptsHint": "包含首次生成与失败后的重试，不小于 1。",
        "devTitle": "开发与调试",
        "devDesc": "切换生成请求的运行方式。"
      }
    },
    "site": {
      "saveLabel": "保存站点设置",
      "mp": {
        "marketplace": "数字资产市场",
        "appVideo": "App 视频",
        "panelTitle": "3. 数字资产市场",
        "panelDesc": "线上没有环境文件时，在这里打开入口",
        "enable": "启用数字资产市场",
        "enableDesc": "保存后用户端出现「数字资产市场」，管理端「业务」出现「数字资产平台运营」。上传仍使用「存储 OSS」。",
        "appEnable": "启用 App 视频服务",
        "appEnableDesc": "保存后开放 App 视频列表和播放。在这里开关即可，不需要改容器环境变量。需要同时启用数字资产市场。",
        "maxDuration": "完整视频最长时长",
        "maxDurationHint": "单位为秒。默认 1800，即 30 分钟。上传、合成和 App 完整播放共用。试看仍最多 15 秒，且不超过原片时长的 30%。",
        "shareTitle": "4. App 互动与作品分享",
        "shareDesc": "初始化数量、真实分享与 iOS / Android 链接关联均在这里配置，无需修改环境文件。",
        "socialInit": "自动初始化互动数量",
        "socialInitDesc": "为新上架且符合 App 展示条件的单视频和分集生成一次初始数量。历史作品请到数字资产平台运营的作品运营页批量补齐；关闭不会清除已保存数量。",
        "sharing": "启用作品分享",
        "sharingDesc": "允许分享单视频和当前短剧分集的业务链接。需要有效的公网 HTTPS 域名，不能填写 localhost 或局域网地址。",
        "shareBase": "分享公网基址",
        "shareBaseHint": "例如 https://www.printfilm.com；域名应将 /s/、/.well-known/apple-app-site-association 和 /.well-known/assetlinks.json 转发至后端，其余作品页面交给 Web。",
        "teamIdHint": "Apple 开发者账号中的 Team ID，用于 Universal Links 关联。",
        "androidPkg": "Android 包名",
        "androidPkgHint": "与安卓应用 applicationId 一致；与证书指纹一起填写。不需要配置 Apple 即可使用安卓分享。",
        "androidSha": "Android 签名证书 SHA-256 指纹",
        "androidShaHint": "每行一条32组冒号分隔的指纹。Google Play 使用应用签名证书，不是上传证书；支持轮换期间多个指纹。公网需放行 /.well-known/assetlinks.json。",
        "androidShaPlaceholder": "AA:BB:…（完整 SHA-256 指纹）",
        "bundleHint": "仅 iOS 使用；复用“支付与通知 → Apple 服务器连接”中的 Bundle ID，安卓无需填写。",
        "iosNotConfigured": "iOS 尚未配置",
        "footnote": "iOS 需配置 Associated Domains，Android 需配置 App Links 并使用实际发布签名完成真机验证。保存域名不会自动修改 DNS、反向代理或客户端工程。"
      }
    },
    "payment": {
      "upstreamModules": "App 支付与媒体价格模块",
      "upstreamModulesDesc": "Apple / Google Play / Android 及按积分的图片视频价格；各区独立保存"
    },
    "routing": {
      "refLimits": {
        "error": "请输入 0–100 的整数",
        "advanced": "高级模型设置",
        "pending": "{n} 项参考上限待修正",
        "summary": "按模型配置参考素材数量",
        "title": "参考素材上限",
        "desc": "限制单次生成可携带的参考图片、视频和音频数量。每项为 0–100 的整数，0 表示不支持；首尾帧与画风板也计入图片数量。",
        "model": "模型",
        "images": "图片 / 张",
        "videos": "视频 / 段",
        "audios": "音频 / 段",
        "unsupported": "不支持",
        "footnote": "这些值用于提交任务前的数量校验。生成图片的模型仅接受图片参考；实际可用能力以对应上游模型为准。"
      }
    }
  },
  "layout": {
    "nav": {
      "adjustments": "手动调账",
      "marketplace": "数字资产平台运营"
    },
    "titles": {
      "teamDetail": "团队详情"
    },
    "closeNav": "关闭导航",
    "openNav": "展开导航",
    "skipToContent": "跳至页面内容",
    "adminNav": "管理导航",
    "mainNav": "主导航",
    "search": {
      "trigger": "搜索管理功能",
      "placeholder": "搜索功能…"
    },
    "userSite": "用户端"
  },
  "tasks": {
    "detail": {
      "notRecorded": "未记录",
      "tabs": {
        "upstream": "上游请求",
        "jsonRedacted": "任务 JSON（脱敏）"
      },
      "alerts": "异常与提示",
      "waitingActivation": "任务尚未激活，等待前置条件或可用并发空位。",
      "payloadHint": "这是内部调度参数；实际发往上游的请求请查看“上游请求”。",
      "frozen": "当前冻结",
      "notSettled": "尚未结算",
      "snapshotMode": "受理时计费模式：{mode} · 路由固定，失败不自动切换",
      "sitePrice": "站内价格 #{v}",
      "legacyRules": "原计费规则",
      "nSeconds": "{n} 秒",
      "nImages": "{n} 张",
      "usageHint": "用量记录表示调用计费依据；钱包实际扣款与退还以任务结算摘要为准。",
      "delivered": "已交付",
      "notDelivered": "未交付"
    },
    "descApiOnly": "统一任务平台 · 自动刷新 {sec}s · 本节点仅 API / 队列由执行节点处理",
    "runtime": {
      "noRecord": "暂无记录",
      "secs": "{s}秒",
      "minsSecs": "{m}分{s}秒",
      "hoursMins": "{h}小时{m}分",
      "ago": "{time}前",
      "apiOnlyNode": "本节点仅 API",
      "unknown": "运行时状态未知",
      "healthy": "运行时正常",
      "unhealthy": "运行时异常",
      "apiOnlyDesc": "本节点仅 API / 队列由执行节点处理",
      "loops": "调度器 {scheduler} · 轮询器 {poller} · 看门狗 {watchdog}",
      "lastSuccess": "最近成功调度：{ago}",
      "consecutiveFailures": "连续失败：{n}",
      "oldestWait": "最老到期待调度已等待：{time}",
      "legend": "待激活表示前置条件或并发空位尚未满足；延时表示尚未到调度时间。"
    },
    "stats": {
      "pendingBreakdown": "待调度 {ready} · 待激活 {deferred} · 延时 {delayed}",
      "activeBreakdown": "执行 {running} · 轮询 {poll} · 取消中 {cancelling}",
      "nodeSlots": "本节点执行槽位",
      "apiOnly": "仅 API",
      "handledByWorkers": "队列由执行节点处理"
    },
    "queues": {
      "title": "调度队列",
      "name": "{label}队列",
      "counts": "排队 {pending} · 在途 {active} · 并发 {max}",
      "awaitingPoll": "等待上游 {n}"
    },
    "cols": {
      "taskModel": "任务 / 模型",
      "upstream": "上游",
      "billing": "计费",
      "elapsed": "耗时",
      "userRef": "用户 / 关联"
    },
    "obs": {
      "phase": {
        "started": "开始请求",
        "accepted": "上游响应",
        "failed": "请求失败",
        "poll": "查询结果",
        "simulated": "本地模拟 · 参数已记录"
      },
      "state": {
        "queued": "上游排队",
        "running": "上游生成中",
        "succeeded": "上游完成",
        "failed": "上游失败",
        "cancelled": "上游已取消",
        "other": "上游状态：{status}"
      },
      "providerOnly": "已有上游任务 · HTTP未记录",
      "noUpstream": "尚无上游请求记录",
      "billing": {
        "none": "未预扣 · 尚未结算",
        "frozen": "已冻结 · 尚未结算",
        "settled": "已结算",
        "skipped": "已跳过预扣 · 尚未结算",
        "unknown": "计费状态未记录"
      },
      "queueType": {
        "text": "文字",
        "image": "图片",
        "video": "视频"
      },
      "lane": {
        "text": "音频与其他",
        "image": "图片",
        "video": "视频"
      },
      "queueBadge": "{type}队列",
      "direct": "直接执行",
      "directDesc": "直接调用 LLM · 不经队列",
      "providerSuffix": " · 上游 {status}",
      "stepNotRecorded": "步骤未记录",
      "modelNotRecorded": "模型未记录",
      "actualModel": "实际请求模型",
      "actualModelShort": "实际模型",
      "simulatedModel": "模拟模型",
      "selectedModel": "任务选择模型",
      "frozenAmount": "冻结 {amount}",
      "notCharged": "未扣费",
      "estimate": "预估 {amount}",
      "refundShort": " · 退 {amount}",
      "refund": " · 退还 {amount}",
      "unsettledSuffix": " · 未结算",
      "timing": "计时中",
      "waitRun": "等待 {wait} · 运行 {run}",
      "notStarted": "未开始",
      "created": "创建 {time}",
      "detail": "详情",
      "cancel": "取消任务",
      "episodeRef": "分集#{id}",
      "fragmentRef": "分镜#{id}",
      "pendingGeneric": "待处理",
      "waitingActivation": "待激活",
      "delayed": "延时等待",
      "ready": "待调度",
      "copied": "已复制",
      "copyFailed": "复制失败，请手动选择",
      "copy": "复制",
      "status": "状态",
      "upstream": "上游",
      "viewRequests": "查看请求",
      "providerTaskMissing": "上游任务 ID 未记录",
      "elapsed": "耗时",
      "billingLabel": "计费 · {state}",
      "settled": "已结算",
      "unsettled": "未结算",
      "breakdown": "明细",
      "notRecorded": "未记录"
    },
    "upstreamPanel": {
      "redacted": "脱敏",
      "notOnPage": "本页未包含，可翻页查看历史记录",
      "latestPhase": "最近阶段",
      "pageCount": "本页 {page} 条 · 历史 {total} 条",
      "refresh": "刷新上游记录",
      "hint": "按事件 ID 倒序分页，本页内按请求 ID 关联提交与响应；同一请求可能跨页，查询事件可能为采样记录。",
      "retry": "重试",
      "loading": "正在加载本页上游事件…",
      "empty": "本页未记录上游 HTTP 请求或模拟请求参数。已有上游任务 ID 或任务已完成，也不能据此还原实际请求体。",
      "localMock": "本地模拟",
      "mediaGeneration": "媒体生成",
      "endpointMissing": "Endpoint未记录",
      "noHttp": "未发送 HTTP",
      "model": "模型",
      "providerTask": "上游任务",
      "requestId": "请求 ID",
      "eventRef": "事件 #{id}",
      "simulatedFinal": "以下为完成渠道路由、模型映射和协议转换后，准备发送的实际 URL、请求头和 JSON 请求体（凭据已脱敏）。在 HTTP 发送前拦截，使用默认媒体结果。",
      "simulatedLegacy": "历史记录仅保存了业务输入参数，不是最终 HTTP 请求体；之后新建的模拟任务会记录最终请求参数。",
      "mockParams": "模拟请求参数",
      "request": "请求",
      "response": "响应",
      "error": "错误",
      "stepData": "已有步骤数据（内部执行记录）",
      "stepDataHint": "以下是步骤输入与结果，不代表实际发往上游的 HTTP 请求体。",
      "stepInput": "步骤输入",
      "stepOutput": "步骤结果"
    }
  },
  "templates": {
    "editor": {
      "errors": {
        "id": "请填写 1–64 个字符的模板 ID",
        "name": "请填写 1–128 个字符的模板名称",
        "shot_duration_min": "最短时长须为大于 0 的整数秒",
        "shot_duration_max": "最长时长须为大于 0 的整数秒",
        "maxLtMin": "最长时长不能小于最短时长",
        "sort_order": "排序值须为整数"
      },
      "untitled": "未命名模板",
      "perShot": "{min}–{max} 秒 / 镜",
      "willPublish": "保存后上架展示",
      "willUnpublish": "保存为下架状态",
      "fixBasics": "请先完善基础信息：{list}。",
      "errorSep": "；",
      "sectionDisplay": "展示信息",
      "sectionDefaults": "生成默认值",
      "idHint": "模板的唯一标识，创建后不可修改。",
      "nameHint": "显示在用户选择模板的列表中。",
      "descHint": "简要说明适合的题材与视觉效果。",
      "categoriesHint": "多个标签用英文逗号分隔。",
      "sortHint": "数值越小越靠前，可使用负数。",
      "shotMaxHint": "不得小于最短时长。",
      "stylePromptHint": "描述画面风格、光线与色彩，会作为生成的基础风格。",
      "characterPromptHint": "用于角色图像的外观与服饰要求。",
      "extraPromptHint": "补充图片生成的统一要求。",
      "llmSystemHint": "追加给文本模型的脚本与规划说明。",
      "negativePromptHint": "列出希望避免出现的画面内容或效果。"
    }
  },
  "users": {
    "role": {
      "user": "普通用户",
      "admin": "管理员"
    },
    "edit": {
      "adjustedSaved": "已调账并保存",
      "saveFailedRetry": "保存失败，请重试",
      "saveAdjust": "确认调账并保存",
      "saveRole": "保存权限修改",
      "currentBalance": "当前账户余额",
      "frozen": "已冻结",
      "frozenHint": "调账不会修改任务已冻结的金额",
      "permissions": "账号权限",
      "roleHint": "管理员可进入管理端，查看和管理全部业务数据。",
      "adjustTitle": "调整账户余额",
      "adjustDesc": "按需开启；仅修改角色时，账户余额保持不变。",
      "direction": "调整方向",
      "increase": "增加",
      "decrease": "减少",
      "amount": "调整金额",
      "amountHint": "大于 0 的金额，最多两位小数。",
      "noteHint": "备注会写入账户流水，便于后续核对。",
      "notePlaceholder": "例如：活动奖励补发、退款扣回",
      "afterSave": "保存后的账户余额",
      "errEmpty": "请输入需要调整的金额",
      "errInvalid": "请输入有效金额（最多两位小数）",
      "errZero": "调整金额须大于 0",
      "errTooLarge": "调整后余额过大，请减少调整金额",
      "errNegative": "减少金额不能超过当前余额"
    }
  },
  "orders": {
    "usage": {
      "modelPlaceholder": "模型（如 seedance-2.5）"
    }
  },
  "finance": {
    "adjustRecords": {
      "credit": "调增",
      "debit": "调减",
      "loadFailed": "加载调账记录失败",
      "title": "手动调账",
      "desc": "用户管理里手动改余额产生的调账流水，含操作人与备注",
      "allDirections": "全部方向",
      "filter": "筛选",
      "listTitle": "手动调账记录",
      "total": "共 {n} 条",
      "colTime": "时间",
      "colUser": "用户",
      "colDirection": "方向",
      "colDelta": "变动",
      "colBalance": "余额后",
      "colOperator": "操作人",
      "colNote": "备注",
      "loading": "加载中…",
      "empty": "暂无手动调账记录"
    }
  },
  "marketplace": {
    "availability": {
      "loading": "正在读取数字资产市场服务状态…",
      "error": "暂时无法获取数字资产市场服务状态，请重试。",
      "reload": "重新加载",
      "disabled": "数字资产市场尚未启用，请先开启此功能后重试。",
      "refresh": "刷新服务状态"
    }
  }
}
