// 与上游合并时新增的文案（自动生成后可手工整理进各命名空间）
export const zhExtra = {
  "studio": {
    "editor": {
      "publishMarketplace": "发布到数字资产市场"
    },
    "style": {
      "resolution": "分辨率",
      "errModelUnsupported": "所选模型不支持当前参数或尚未配置价格，请检查模型、分辨率和画幅。"
    },
    "board": {
      "stopGenerate": "停止生成",
      "errStop": "停止失败",
      "downloadFinal": "下载成片",
      "errDownload": "下载失败",
      "publishMarketplace": "发布到数字资产市场",
      "opPreviewVideo": "预览视频",
      "subtitleHintFull": "作为分镜说明使用",
      "subtitleHintStill": "可选，会和标题一起显示在成片中",
      "imgPromptStill": "画面描述",
      "imgPromptHintStill": "描述角色、场景和动作；修改后可重新生成这一张图片"
    }
  },
  "drama": {
    "episodesStep": {
      "planFailedShort": "分镜失败",
      "awaitingPlan": "待 AI 分镜"
    },
    "outlinePreview": {
      "durationScriptChanged": "时长为当前剧本估算；已有分镜仍为旧稿"
    },
    "outlineEp": {
      "genTitles": {
        "creative": "正在生成本集创作思路",
        "summary": "正在生成本集梗概",
        "brief": "正在提取本集梗概",
        "body": "正在生成拍摄剧本",
        "full": "正在重新生成整集",
        "default": "正在生成本集内容"
      },
      "jobFailedOrCancelled": "本集生成失败或已取消",
      "selectEpisodeFirst": "请先选择分集",
      "episodeMissing": "分集不存在，请刷新",
      "saveBeforeGenerate": "请先保存或取消正在编辑的内容，再生成。",
      "saveBeforeEnter": "请先保存或取消正在编辑的内容，再进入分镜。",
      "saveSceneFirst": "请先保存或取消正在编辑的场次。",
      "needSummaryOrCreative": "请填写至少 40 字的本集梗概，或至少 {n} 字的创作备注",
      "needSummaryBeforeBody": "请先填写本集梗概，再生成拍摄剧本",
      "bodyBeforeExtract": "拍摄剧本需满 {n} 字后再提取本集梗概",
      "regenMessageV2": "将优先按本集梗概重写拍摄剧本；没有梗概时使用创作备注。若本集已进入分镜，之后重新分镜会覆盖并清空已生成镜头。是否继续？",
      "planGenerating": "AI 分镜中…",
      "planFailed": "分镜失败",
      "shotStatusStale": "{s}（旧稿）",
      "shotStatusFew": "{s}（偏少）",
      "wholeProgress": "整剧进度 {done}/{total}",
      "waitingScript": "等待生成剧本…",
      "waitingPlan": "待 AI 分镜",
      "needSummary": "待填写梗概",
      "emptySummaryGenerating": "全剧摘要生成中，完成后会抽取资产并生成各集剧本…",
      "emptyAssetsSeeding": "正在抽取资产库，随后生成各集剧本…",
      "unsavedEdit": "编辑未保存",
      "planStale": "分镜待更新",
      "extracting": "提取中…",
      "extractBrief": "提取本集梗概",
      "batchLocksHint": "本集剧本尚未生成完，请稍候",
      "otherJobHint": "另有单集生成进行中",
      "bodyMinHint": "剧本内容需满 {n} 字",
      "noticeScriptChangedTitle": "剧本已更新，分镜待同步",
      "noticeScriptChangedBody": "现有分镜仍为旧稿，进入分镜后请重新分镜。",
      "noticeSummaryTitle": "正在生成全剧摘要",
      "noticeSummaryBody": "完成后将抽取角色与场景资产，再生成各集剧本。",
      "noticeAssetsTitle": "正在抽取角色与场景资产",
      "noticeAssetsBody": "写入资产库后，将开始生成分集剧本。",
      "noticeEpisodesTitle": "正在生成分集剧本",
      "noticeEpisodesProgress": "已完成 {done} / {total} 集，可先浏览已完成的内容。",
      "noticeEpisodesBody": "可先浏览已完成的分集内容。",
      "noticeThisBody": "内容生成后将自动更新，请稍候。",
      "noticeOtherTitle": "第 {n} 集正在生成",
      "noticeOtherBody": "可继续创作当前分集。",
      "noticePlanTitle": "正在生成本集 AI 分镜",
      "noticePlanBody": "分镜完成后，可进入查看与编辑。",
      "noticePlanPreparing": "本集剧本已就绪，正在准备 AI 分镜",
      "noticePlanSkippedTitle": "本集未能自动 AI 分镜",
      "noticePlanTooShortChars": "本集剧本过短，无法自动 AI 分镜（约 {have} 字，至少需要 {need} 字）。请补充剧本或用 AI 优化正文，保存后再点击「进入分镜」。",
      "noticePlanTooShortWords": "本集剧本过短，无法自动 AI 分镜（约 {have} 词，至少需要 {need} 词）。请补充剧本或用 AI 优化正文，保存后再点击「进入分镜」。",
      "noticePlanFailedBody": "自动分镜未能开始：{reason}。可点击「进入分镜」手动重试。",
      "summarySubV2": "本集人物、冲突、转折与结局；生成拍摄剧本的主要依据",
      "summaryPlaceholderV2": "填写本集梗概（至少 40 字），再生成拍摄剧本",
      "extractFromScript": "从剧本提取",
      "genFromNotes": "从备注生成",
      "notesTitle": "创作备注（可选）",
      "notesSub": "补充创作方向或保留早期创意；已有梗概时无需填写",
      "notesPlaceholder": "可选：补充人物动机、创作方向或特别要求"
    },
    "outline": {
      "pipelineSummary": "全剧摘要生成中…",
      "pipelineAssets": "抽取资产中…",
      "pipelineEpisodes": "分集剧本生成中…",
      "pipelineEpisodesProgress": "分集剧本生成中 · 整剧进度 {done}/{total}",
      "pipelineHintSummary": "顺序：整剧摘要 → 抽取资产 → 分集剧本 → 每集立刻 AI 分镜",
      "pipelineHintAssets": "正在从整剧摘要抽取角色/场景到资产库，完成后开始生成各集剧本",
      "pipelineHintEpisodes": "每集剧本完成后立即执行 AI 分镜；左侧可看「AI 分镜中…」状态",
      "summaryGeneratingSuffix": " · 全剧摘要生成中…",
      "assetsSeedingSuffix": " · 抽取资产中…"
    },
    "teamLock": {
      "acquiring": "正在取得编辑占用…",
      "retryRefresh": "重新取得编辑权并刷新",
      "retry": "重新取得编辑权"
    },
    "cardMenu": {
      "publishMarket": "发布到数字资产市场"
    },
    "output": {
      "noteEpisodeModel": "仅本集分镜使用；未单独设置时继承项目默认。比例与清晰度随当前视频模型过滤，可点选修改。",
      "noteProjectModel": "全部分集共用同一规格；比例与清晰度随当前视频模型过滤。"
    },
    "assetLibrary": {
      "unnamedProject": "未命名项目",
      "unassigned": "未关联项目",
      "kindDrama": "漫剧项目",
      "kindShortVideo": "AI短视频",
      "playFailedRetry": "播放失败，请重试",
      "digitalTitle": "数字资产库",
      "digitalSubtitle": "按图片、视频、音频浏览，可筛选已生成与未生成资产；图片可进一步筛选角色、场景与道具",
      "countItems": "{n} 项资产",
      "bannerTitle": "一次创作，让灵感多次发生。",
      "bannerText": "项目素材、分镜视频与成片汇集在这里，按来源项目筛选；独立生成的素材也可直接预览与下载。",
      "reload": "重新加载",
      "loadingAssets": "正在加载资产…",
      "srcFragment": "分镜视频",
      "srcTask": "生成结果",
      "srcStandalone": "独立生成",
      "srcProject": "项目素材",
      "wsProject": "项目资产",
      "wsPersonal": "个人资产",
      "playing": "正在试听",
      "canPreview": "可试听",
      "previewAudio": "试听音频",
      "preview": "试听",
      "viewAsset": "查看素材",
      "openSourceProject": "打开来源项目"
    },
    "common": {
      "voiceGenDisabled": "音色生成暂时停用，可选择已有音色或上传音频。"
    },
    "voiceBind": {
      "uploadBadType": "请上传 mp3 / wav / m4a 音频文件",
      "uploadNoUrl": "上传成功但未得到可播放地址",
      "pickOrUpload": "请先选择或上传一段可试听的音频",
      "leadUpload": "给「{name}」配上说话声音。选择已有音色或上传录音",
      "leadAiSuffix": "，也可用 AI 合成",
      "canvasHint": "画布里也可以把「音频」节点连到角色，效果一样。之后生成带对白的镜头时，会尽量按这段声音来念。",
      "sourceAria": "音色来源",
      "uploadAudio": "上传音频",
      "aiSynth": "AI 合成",
      "noVoicesUploadOrAi": "还没有可用音色，请先「上传音频」或「AI 合成」。",
      "noVoicesUpload": "还没有可用音色，请先「上传音频」。",
      "uploaded": "已上传",
      "uploadHint": "支持 mp3 / wav / m4a。建议 2 秒以上的清晰人声，效果更稳。",
      "chooseAudioFile": "选择音频文件"
    },
    "list": {
      "relationAll": "全部项目",
      "relationOwned": "我创建的",
      "relationJoined": "我参与的",
      "relationAria": "项目分类"
    },
    "seedanceRules": {
      "payload": {
        "refAudioDesc": "：本镜开口且已绑定音色的角色 / 旁白试听音频",
        "audioNoteSubtitle": "系统默认开启 {code}：有口播意图时 Seedance 原生配音；字幕默认后期叠字（画面内禁止烧录）；纯画面镜仅环境音。",
        "orderCharacterVoice": "【强制约束：角色音色】— 角色名 → 参考音频序号（已绑且本镜开口）",
        "orderNarrationVoice": "【强制约束：旁白音色】— 旁白 → 参考音频序号（已绑项目旁白音色）"
      },
      "script": {
        "assetNeedImageVoice": "被引用的角色需有参考图；要对白的角色建议绑定试听，未绑则由 Seedance 自发挥口播"
      },
      "usage": {
        "check2Voice": "本镜「参与资产」中的角色已有参考图（缺图不能生成）；要对白角色建议绑定音色（缺音色警告可继续）",
        "voiceTitle": "音色与参考音频",
        "voiceBind": "资产库 / 分集 / 画布可为角色绑定试听；本镜开口时提交为 reference_audio",
        "voiceUnbound": "未绑定音色时，口播由 Seedance generate_audio 自行发挥",
        "voiceNeedImage": "关联角色/场景/道具须先有参考图（生成或上传），否则不能生成视频"
      }
    }
  },
  "episode": {
    "assetPanel": {
      "voiceBound": "已绑定音色"
    },
    "sidePane": {
      "publishMarket": "发布到数字资产市场"
    },
    "edit": {
      "outputClamped": "规格已按当前模型调整为 {label}，已生成镜头需重生成才会按新规格出片",
      "needRefFirst": "先补参考图",
      "needRefImageHint": "请先为关联角色/场景/道具生成或上传参考图。",
      "readOnlySave": "当前只读，无法保存分镜",
      "enterCanvas": "进入画布"
    },
    "canvas": {
      "quickAddDblClick": "点击快速添加 · 空白处双击也可新建",
      "uploadAudio": "上传音频",
      "openVoiceBindFailed": "无法打开音色绑定",
      "selectAudioFile": "请选择音频文件（MP3 / WAV / M4A 等）",
      "audioTooLarge": "音频不能超过 30MB",
      "changeVoiceTitle": "更换或解绑音色；也可改连其他音频节点",
      "opening": "打开中…",
      "changeVoice": "更换",
      "bindVoiceTitle": "上传/选择音色，或把「音频」节点连到本角色",
      "bindVoice": "绑定音色",
      "mention": {
        "emptyConnected": "无已连线节点 · 先把角色/场景连到本节点"
      },
      "gen": {
        "videoPlaceholderConnected": "描述视频画面、镜头运动与氛围；键入 @ 引用已连线节点…",
        "videoHintConnected": "Enter 生成视频 · @ 仅可引用已连线节点 · Shift+Enter 换行",
        "imagePlaceholderConnected": "描述画面内容；键入 @ 引用已连线节点…",
        "imageHintConnected": "Enter 生成 · @ 仅可引用已连线节点 · Shift+Enter 换行",
        "optimizeFailed": "描述优化失败",
        "optimizeTitle": "优化画面描述，并保留台词与 @ 引用",
        "optimize": "描述优化",
        "submitting": "生成中",
        "promptLabel": "提示词",
        "mentionHint": " · @ 引用连线节点",
        "charCount": "{n} 字",
        "refLimitsTitle": "首尾帧和画风板计入参考图片数量；0 表示模型不支持此类参考。",
        "refLimits": "参考上限：图片 {images} · 视频 {videos} · 音频 {audios}",
        "kbdGenerate": "生成",
        "kbdNewline": "换行"
      },
      "store": {
        "nodeAssetExists": "创建节点失败：资产已存在于画布",
        "noAudio": "所选资产没有可用音频",
        "voiceBindFailed": "音色绑定失败",
        "audioNodeEmpty": "请先给音频节点上传或选用音频，再连到角色",
        "audioAssetMissing": "音频资产不存在",
        "defaultVoiceName": "音色"
      }
    },
    "genOpts": {
      "imageParamsAdjusted": "所选模型不支持原参数，已调整画幅或分辨率，请核对报价后生成。",
      "videoParamsAdjusted": "所选模型不支持原参数，已调整规格，请核对时长和报价后生成。"
    }
  },
  "lib": {
    "scriptValidate": {
      "missingImageBlocking": "以下关联资产缺少参考图，请先生成或上传后再生成视频：{names}"
    },
    "genError": {
      "audioShort": {
        "messageDur": "{where} 参考音频约 {sec} 秒，须 ≥ 1.8 秒。"
      },
      "notEnabled": {
        "title": "图像模型未开通",
        "suggestion": "请管理员在后台「系统设置 → 模型」为对应渠道开通该模型后再生成。"
      },
      "downloadInterrupted": {
        "title": "成片下载中断",
        "message": "视频已在上游生成，但下载到服务器时连接被中断。",
        "suggestion": "系统会沿原任务自动重试下载，请勿重新生成该节点。"
      },
      "fetchFailed": {
        "title": "网络中断",
        "message": "请求后端失败（Failed to fetch）。任务可能仍在排队或已完成。",
        "suggestion": "请刷新画布查看节点是否已有成片；没有的话再点一次生成。开发时后端 --reload 热重载也容易触发此提示。"
      },
      "audioPrivacy": {
        "title": "参考音频未通过隐私审核",
        "suggestion": "检查对应角色的音色绑定，更新参考音频后再生成。"
      },
      "audioUnreadable": {
        "title": "参考音频无法校验",
        "message": "无法读取 {named} 的参考音频时长或地址无效。",
        "suggestion": "请检查角色/旁白试听文件是否可访问，重新上传或生成后再生成该分镜。"
      },
      "audioLong": {
        "title": "参考音频过长",
        "message": "{named} 参考音频过长，须 ≤ 30 秒。",
        "messageDur": "{named} 参考音频过长（约 {sec} 秒），须 ≤ 30 秒。",
        "suggestion": "请截短对应角色/旁白试听音频后再生成该分镜。这不是参考图问题。"
      },
      "invalidImage": {
        "title": "参考图格式无效",
        "whereIndex": "提交内容第 {n} 项 / content[{idx}]",
        "whereAny": "某张参考图",
        "message": "视频服务按图片校验失败：{where}。这不是参考音频时长问题。",
        "suggestion": "请检查本镜角色/场景封面是否为 PNG/JPG/WEBP；若画布上挂了独立音色节点，确认它只作参考音频、不要占用参考图。修好素材后重新生成该分镜。"
      }
    }
  },
  "assetLib": {
    "types": {
      "character": "角色",
      "scene": "场景",
      "prop": "道具",
      "voice": "音色",
      "audio": "音频",
      "image": "图片",
      "video": "视频",
      "text": "文本"
    },
    "voiceAsset": "音色资产",
    "audioAsset": "音频资产",
    "videoAsset": "视频资产",
    "noPreview": "暂无预览图",
    "unnamed": "未命名资产",
    "generating": "生成中",
    "selected": "已选择",
    "selectedPrefix": "已选择，",
    "open": "打开{name}",
    "filterByType": "按资产类型筛选",
    "searchPlaceholder": "搜索资产名称或描述",
    "searchAria": "搜索资产",
    "bannerTitle": "一次创作，让灵感多次发生。",
    "emptyTitle": "暂无符合条件的资产",
    "emptyHint": "调整筛选条件，或在项目中添加新的资产。",
    "filters": {
      "mediaAria": "按媒体大类筛选",
      "imageCategory": "图片分类",
      "imageCategoryAria": "按图片分类筛选",
      "allImages": "全部图片",
      "generationStatus": "生成状态",
      "generationStatusAria": "按生成状态筛选",
      "all": "全部",
      "generated": "已生成",
      "ungenerated": "未生成"
    },
    "detail": {
      "title": "资产详情",
      "copied": "已复制完整提示词",
      "copyFailed": "复制失败，请手动复制",
      "downloadStarted": "已开始下载",
      "downloadFailed": "下载失败",
      "mediaPreview": "媒体预览",
      "noText": "暂无文本",
      "zoomOut": "退出放大",
      "zoomIn": "放大预览",
      "closeAria": "关闭资产详情",
      "genPrompt": "生成提示词",
      "assetNote": "资产说明",
      "source": "来源",
      "model": "模型",
      "notRecorded": "未记录",
      "dimensions": "媒体尺寸",
      "audioDuration": "音频时长",
      "videoDuration": "成片时长",
      "fileSize": "文件大小",
      "recordedAt": "记录时间",
      "sourceProject": "来源项目",
      "copyNote": "复制说明",
      "downloading": "下载中…",
      "download": "下载",
      "close": "关闭"
    },
    "info": {
      "yes": "是",
      "no": "否",
      "seconds": "{n} 秒",
      "source": {
        "upload": "上传",
        "generated": "AI 生成",
        "unknown": "未记录"
      },
      "params": {
        "requestedAspect": "设定画幅",
        "aspect": "比例",
        "requestedResolution": "设定分辨率",
        "resolution": "分辨率",
        "requestedSize": "设定尺寸",
        "size": "尺寸",
        "duration": "时长",
        "requestedDuration": "设定时长",
        "videoMode": "生成方式",
        "count": "生成数量",
        "negative": "负向提示词",
        "strength": "参考强度",
        "motion": "运动幅度",
        "imageStyle": "画面风格",
        "generateAudio": "生成声音",
        "watermark": "水印",
        "cameraFixed": "固定镜头",
        "seed": "随机种子",
        "speaker": "音色",
        "sampleText": "试听文本"
      },
      "modes": {
        "textToVideo": "文生视频",
        "firstLastFrame": "首尾帧",
        "omniReference": "全能参考"
      }
    },
    "refs": {
      "numbered": "{kind}{n}",
      "listSep": "、",
      "nameWithLabel": "{name}（{label}）",
      "previewMention": "预览{name}，{labels}",
      "collapse": "收起",
      "expand": "展开全文",
      "sectionAria": "本次生成的参考素材",
      "title": "参考素材",
      "kindTitle": "参考{kind}",
      "preview": "预览{label}",
      "previewNamed": "预览{label}：{name}",
      "firstFrame": "首帧",
      "lastFrame": "尾帧",
      "audioAria": "{label}：{name}",
      "audioFallback": "参考音频",
      "loadFailed": "参考素材暂时无法加载"
    },
    "edit": {
      "genLabel": "生成形象",
      "deleteScene": "删除场景",
      "deleteProp": "删除道具",
      "deleteCharacter": "删除角色",
      "assetDeleted": "资产已删除，请关闭后重新加载",
      "promptEmpty": "提示词不能为空",
      "savePromptFailed": "保存提示词失败",
      "uploadFailed": "上传失败",
      "restoreFailed": "还原失败",
      "readOnly": "只读查看",
      "acquiringLock": "正在取得编辑占用…",
      "retry": "重新尝试",
      "generating": "生成中…",
      "editPrompt": "编辑下次生成的提示词",
      "imagePrompt": "生图提示词",
      "promptPlaceholder": "描述外观、构图、光影与风格…",
      "saving": "保存中…",
      "savePrompt": "保存提示词",
      "uploading": "上传中…",
      "replaceImage": "更换图片",
      "uploadImage": "上传图片",
      "replaceVoice": "更换音色",
      "bindVoice": "绑定音色",
      "historyCount": "历史版本 · {n} 个",
      "viewHistory": "查看历史版本详情",
      "restoring": "还原中…",
      "restore": "还原",
      "historyName": "{name} · 历史版本",
      "assetFallback": "资产"
    }
  },
  "canvasTeams": {
    "loadFailed": "项目加载失败",
    "title": "项目团队",
    "intro": "每个画布项目独立管理成员，通过项目分享邀请伙伴。",
    "myProjects": "我的项目",
    "filterAria": "项目团队分类",
    "all": "全部项目",
    "owned": "我创建的",
    "joined": "我参与的",
    "note": "成员权限仅限所属画布项目。生成费用从发起人的个人余额扣除。",
    "loading": "正在加载项目…",
    "retry": "重试",
    "openCanvas": "打开画布",
    "manage": "管理成员与邀请",
    "viewMembers": "查看项目成员",
    "empty": "暂无此类项目。创建画布项目或接受项目邀请后，将显示在这里。"
  },
  "teamBoundary": {
    "readOnlyNotice": "当前只读",
    "retryEdit": "重新尝试编辑",
    "episodeMismatch": "分集不属于当前项目",
    "episodeLoadFailed": "分集加载失败",
    "retry": "重试",
    "loadingEpisode": "正在读取分集与编辑权限"
  }
}
