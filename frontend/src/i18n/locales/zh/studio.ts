/** zh: studio 命名空间（t('studio.xxx')） */

export const zhStudio = {
  // 模板原始分类（后端 category 字段）的展示名
  category: {
    all: '全部',
    hot: '热门推荐',
    general: '通用',
    openSource: '开源',
    kepu: '科普',
    leadGen: '获客',
    documentary: '纪录片',
    realistic: '写实感',
    lifelike: '真人感',
    cinematic: '电影感',
    kids: '儿童',
    anime: '动漫',
    guofeng: '国风',
    scifi: '科幻',
    fantasy: '奇幻',
    suspense: '悬疑',
    business: '商业',
    retro: '复古',
    imageText: '图文',
  },
  contentLocale: {
    label: '内容语言',
    hint: 'AI 将用该语言撰写脚本、旁白与字幕',
    options: {
      zh: '中文（普通话）',
      en: '英语（English）',
      vi: '越南语（Tiếng Việt）',
    },
  },
  templates: {
    title: '模板库',
    subtitle: '为科普与知识短片挑选画面语言',
    searchPlaceholder: '搜索模板名称或描述',
    categoryAria: '模板分类',
    empty: '没有匹配的模板。',
  },
  create: {
    back: '新建项目 / 开始创作',
    title: '创建项目',
    chooseTemplate: '选择模板',
    searchPlaceholder: '搜索模板…',
    categoryAria: '模板分类',
    inputContent: '输入内容',
    tabTheme: '一句话主题',
    tabScript: '粘贴完整文案',
    projectName: '项目名称',
    projectNamePlaceholder: '将根据内容自动填充',
    untitled: '未命名作品',
    aiBusy: '生成中…',
    aiExpandScript: 'AI 扩写文案',
    aiGenerateTheme: 'AI 生成主题',
    aiHintScript: '可从一句话扩成完整口播',
    aiHintTheme: '补全受众与知识点',
    placeholderTheme: '例如：黑洞是如何形成的？用通俗方式讲清引力与时空',
    placeholderScript: '粘贴或 AI 生成完整口播文案…',
    charCount: '{n} 字',
    inspirations: '灵感示例',
    shuffle: '换一批',
    inspirationHintScript: '点击示例会填充完整文案并自动写入项目名称',
    inspirationHintTheme: '点击示例会填充完整主题并自动写入项目名称',
    tip: '主题越具体，AI 越容易生成准确的科普分镜与旁白。可写清受众与核心知识点。',
    summary: '创作摘要',
    pickTemplate: '请选择模板',
    workName: '作品名称',
    outputMode: '输出模式',
    outputVideo: '视频 · {ratio}',
    estDuration: '预估时长',
    estDurationValue: '~1–3 分钟',
    inputMode: '输入方式',
    creating: '创建中…',
    nextStyle: '下一步：风格配置',
    aiBusyLong: 'AI 生成中…',
    aiHelp: '不够完整？让 AI 帮你写',
    footHint: '画风已随模板带上。下一步确认配音与成片方式。',
    aiSeedFallback: '人工智能如何改变生活',
    errAi: 'AI 生成失败',
    errRequired: '请选择模板并填写主题内容',
    errCreate: '创建失败',
    // 灵感示例：会作为主题/文案发给 AI，按内容语言取对应版本
    pool: [
      {
        title: '到店打卡怎么拍',
        theme: '把一家本地店的卖点做成抖音获客口播：前3秒钩子、场景、1-2个体验、到店号召。只写已知事实。',
        script:
          '路过这条街十次，这次才走进去。\n\n' +
          '店面不大，招牌清楚，位置就在地铁口附近。\n\n' +
          '我点了他们家主打那一项，口感按我自己的感受来：味道正、上桌快。\n\n' +
          '想试的话，按店里现有套餐自己看，别听绝对化承诺。',
      },
      {
        title: '闺蜜安利一篇笔记',
        theme: '小红书获客安利：钩子标题、第一印象、分点真实体验、推荐给谁。卖点只作客观陈述。',
        script:
          '本来只是路过，结果在店里坐了很久。\n\n' +
          '第一印象是光线干净、座位不挤。\n\n' +
          '我点了招牌，份量如实说；环境安静，适合聊天。\n\n' +
          '更适合想慢慢坐的人；赶时间的可以先看套餐再决定。',
      },
      {
        title: '口碑拆解给决策',
        theme: '点评式获客讲解：总体评价、环境服务、推荐项带理由、性价比、适合谁。没写的价格不要猜。',
        script:
          '总体感受：干净、流程清楚，适合第一次来的人。\n\n' +
          '环境通透，服务员会主动说明怎么选。\n\n' +
          '推荐他们家主打项目，理由是我当场体验过、步骤好懂。\n\n' +
          '人均以店内公示为准。带朋友来比一个人更合适。',
      },
      {
        title: '熟人圈轻推荐',
        theme: '朋友圈获客短片：一句真实感受、一个具体细节、一句轻推荐。克制，不像广告。',
        script:
          '今天路过顺路坐了一会儿，比想象中安静。\n\n' +
          '窗边那张桌子有自然光，适合歇脚。\n\n' +
          '你们要是附近，可以自己去看看。',
      },
      {
        title: '黑洞是如何形成的',
        theme: '黑洞是如何形成的？用通俗方式讲清恒星坍缩、事件视界与时空弯曲，面向中学生。',
        script:
          '夜空里最神秘的天体之一，就是黑洞。\n\n' +
          '当一颗足够大的恒星燃料烧尽，核心会在引力下剧烈坍缩，密度高到连光都逃不出去，事件视界就此诞生。\n\n' +
          '它不是宇宙吸尘器，而是时空被严重弯曲的区域。靠近它，时间流逝也会变得奇怪。\n\n' +
          '记住：质量够大、坍缩够猛，黑洞就会出现。下一次看科普新闻，你就能分清传说与科学。',
      },
      {
        title: '为什么天空是蓝色的',
        theme: '为什么天空是蓝色的？用瑞利散射解释阳光、空气分子与傍晚火烧云，适合科普入门。',
        script:
          '抬头一看，白天的天空常常是蓝的，这是巧合吗？\n\n' +
          '阳光看起来发白，其实包含多种颜色。空气分子对蓝光散射更强，蓝光更容易被「弹」向四面八方，于是我们眼里的天空偏蓝。\n\n' +
          '早晚太阳更低，光穿过更厚大气，蓝光散得更干净，剩下的红橙光就染红了天边。\n\n' +
          '所以天空的颜色，是光与空气的一场合作。',
      },
      {
        title: 'AI 如何改变生活',
        theme: 'AI 如何改变生活：从推荐、语音助手到医疗影像，讲清便利与需要警惕的偏见。',
        script:
          '打开手机，推荐视频、导航路线、语音助手——人工智能已经悄悄进了日常。\n\n' +
          '它擅长从海量数据里找规律：帮医生看影像线索，帮工厂预判故障，也帮你把搜索变成对话。\n\n' +
          '但 AI 不是魔法。数据有偏见，模型会犯错，隐私也需要边界。真正有用的，是把 AI 当工具，而不是当权威。\n\n' +
          '理解它能做什么、不能做什么，你才能用得更聪明。',
      },
      {
        title: '火星上的一天',
        theme: '火星上的一天长什么样？对比地球日长、气温、沙尘与人类基地想象，做成场景化科普。',
        script:
          '想象你在火星醒来：太阳更远更小，天空偏奶油色，一天大约 24 小时 39 分钟。\n\n' +
          '白天可能「温暖」到零下，夜晚更冷。薄薄的二氧化碳大气留不住热量，沙尘暴偶尔遮天。\n\n' +
          '科学家仍在规划基地：要防辐射、造氧气、种食物。火星不是第二地球，却是最近的外太空课堂。\n\n' +
          '了解火星的一天，就是在预习人类下一次远行。',
      },
      {
        title: '梦的力量',
        theme: '梦的力量：睡眠周期、快速眼动与记忆整理，用故事讲清做梦如何帮助大脑「复盘」。',
        script:
          '你睡着以后，大脑并没有下班。\n\n' +
          '进入快速眼动睡眠时，大脑像在回放白天的片段，拼接成奇幻的梦。科学家认为，这有助于整理记忆、调节情绪。\n\n' +
          '睡不够，注意力和创造力都会打折；规律睡眠，则像给大脑做夜间维护。\n\n' +
          '下次做怪梦，别只觉得荒唐——那可能是大脑在加班学习。',
      },
      {
        title: '一只流浪猫的春天',
        theme: '一只流浪猫的春天：用拟人旁白讲城市生态、投喂边界与人宠共处，温暖向科普叙事。',
        script:
          '春天来了，巷口的橘猫开始换毛，也开始寻找更安全的角落。\n\n' +
          '城市里的流浪动物，靠的是残存野性与人类不经意的善意。科学投喂、绝育与尊重距离，比冲动更重要。\n\n' +
          '它们不是风景，也不是麻烦，而是城市生态的一部分。\n\n' +
          '这个春天，愿每一只猫，都能遇见更稳妥的明天。',
      },
      {
        title: '光合作用的秘密',
        theme: '光合作用的秘密：叶子如何把阳光变成糖，讲清叶绿体、能量转化与地球氧气来源。',
        script:
          '绿叶不只是装饰，它们是地球上最安静的化工厂。\n\n' +
          '叶绿体抓住阳光，把水和二氧化碳做成糖，并释放氧气。没有这个过程，绝大多数食物链都会断裂。\n\n' +
          '你呼吸的氧气、餐桌上的米饭和蔬菜，都间接来自这场光的魔法。\n\n' +
          '看懂光合作用，就看懂了生命运转的底层账本。',
      },
      {
        title: '地震来了怎么办',
        theme: '地震来了怎么办：用场景教学讲清震前准备、避险姿势与谣言辨别，实用安全科普。',
        script:
          '地面突然晃起来，第一反应往往是慌。\n\n' +
          '正确做法是就近伏地、掩护、抓稳，远离窗户与高架物；不要一窝蜂挤电梯。提前准备应急包，比临时抱佛脚更管用。\n\n' +
          '震后还要警惕余震和谣言。权威信息、互助秩序，才是真正的安全感。\n\n' +
          '懂一点地震知识，关键时刻就能多一分从容。',
      },
      {
        title: '咖啡因如何提神',
        theme: '咖啡因如何提神：腺苷受体、耐受与睡眠代价，帮上班族科学喝咖啡。',
        script:
          '困的时候来杯咖啡，真的是「叫醒大脑」吗？\n\n' +
          '咖啡因会抢占腺苷的位置，让你暂时感觉不困。但它不能替代睡眠，下午喝太多，夜里更容易翻来覆去。\n\n' +
          '逐渐耐受后，同样一杯效果会变弱。更聪明的用法是：需要专注时再用，并给睡眠留窗口。\n\n' +
          '提神可以靠咖啡，恢复还是得靠睡。',
      },
      {
        title: '塑料去哪了',
        theme: '塑料去哪了：微塑料、海洋环流与可替代材料，做成环保主题科普短片。',
        script:
          '扔掉的塑料袋，真的消失了吗？\n\n' +
          '多数只是被撕成更小的碎片。微塑料进入河流与海洋，再进入食物链，最终可能回到我们的餐桌。\n\n' +
          '减少一次性塑料、做好分类、推动更好的材料，比事后清理便宜得多。\n\n' +
          '问「塑料去哪了」，其实是在问：我们愿为未来留什么。',
      },
      {
        title: '疫苗为什么有效',
        theme: '疫苗为什么有效：用「预演」比喻讲清抗原、抗体与群体免疫，澄清常见误解。',
        script:
          '疫苗不是药，更像给免疫系统发的预告片。\n\n' +
          '它让身体提前认识病原体的关键特征，真正遇到时能更快调动抗体。这不是改写基因，而是训练记忆。\n\n' +
          '足够多人获得保护，传播链会被削弱，这就是群体免疫的意义。\n\n' +
          '科学接种，是把自己和身边人一起放进更安全的网络。',
      },
      {
        title: '潮汐的涨落',
        theme: '潮汐为何涨落：月球引力、离心效应与大潮小潮，海边场景化讲解。',
        script:
          '海边的人最懂：水位会按时涨、按时退。\n\n' +
          '主要推手是月球的引力，太阳也来凑热闹。地球、月球、太阳排成一线时，潮差更大，就是大潮。\n\n' +
          '潮汐还影响航行、发电甚至生物节律。抬头看月亮，脚下的海也在回应。\n\n' +
          '涨落之间，是天地引力的可见痕迹。',
      },
    ],
  },
  style: {
    back: '返回创作台',
    fallbackTitle: '风格配置',
    projectInfo: '项目信息',
    theme: '主题',
    duration: '时长',
    durationValue: '~1–3 分钟',
    shotCount: '分镜数',
    shotCountAuto: 'AI 自动',
    previewTemplate: '预览模板',
    visualStyle: '画面风格',
    visualStyleHint:
      '已由选题时选择的模板锁定，出图与出视频会自动带上画风。是否出角色由模板规则和主题让 AI 决定，不必再选一套人设。',
    templateStyle: '模板画风',
    stylePromptLabel: '风格提示词（可选覆盖）',
    voiceTitle: '配音音色',
    moreVoices: '更多音色',
    female: '女声',
    male: '男声',
    generating: '生成中…',
    playing: '播放中',
    preview: '试听',
    currentVoice: '当前：{name} · 成片用该音色整片配音；点击「试听」可听约 5 秒样例',
    outputTitle: '成片方式',
    outputHint: '任意模板都可选择是否生成 AI 视频，与画幅无关。',
    modeFull: 'AI 视频',
    modeFullDesc: '图→视频→配音→合成',
    modeImageText: '静图成片',
    modeImageTextDesc: '静图+叠字+配音，不生成 AI 视频',
    imageModel: '图片模型',
    imageModelHint: '使用管理后台「模型」中已勾选的 TokenFree 模型。',
    recommended: '推荐',
    videoModel: '视频模型',
    videoModelHint: '图生视频所用模型；静图成片模式不调用。',
    ratioTitle: '输出比例',
    livePreview: '实时预览',
    previewPlaceholder: '预览占位',
    livePreviewHint: '生成后可在分镜台查看真实画面。当前为模板预览。',
    overview: '当前配置概览',
    ovStyle: '风格',
    ovCharacter: '角色',
    ovCharacterValue: 'AI 按模板与主题决定',
    ovVoice: '配音',
    ovVoiceDefault: '默认',
    ovRatio: '比例',
    ovOutput: '成片',
    ovContentLocale: '内容语言',
    stopPreview: '停止试听',
    previewNamed: '试听「{name}」',
    starting: '启动中…',
    saveContinue: '保存并继续',
    generateBoard: '生成故事板',
    footHint: '先生成分镜脚本，确认修改后再手动开始出图与配音。',
    errPreviewPlay: '试听播放失败',
    errPreview: '试听失败',
    errGenerate: '生成失败',
    errCompose: '合成失败',
    errLoad: '加载失败',
    loading: '加载中…',
  },
  board: {
    back: 'AI 生成故事板 / 分镜工作台',
    loading: '加载中…',
    errLoad: '加载失败',
    previewFinal: '预览成片',
    compose: '拼接成片',
    recompose: '重新拼接',
    recomposeTitle: '用当前镜头重新拼接',
    batchAdjust: '批量调整',
    restart: '推倒重做',
    openEditor: '打开编辑器',
    generating: '生成中…',
    goStyle: '去风格页生成分镜',
    confirmGenerate: '确认分镜，逐镜出图与配音',
    genVideos: '逐镜出视频',
    continueGenerate: '继续生成',
    // 左侧项目设置
    settings: '项目设置',
    changeCover: '更换封面',
    firstShotCover: '用首镜封面',
    firstShotCoverTitle: '使用第一个有画面的镜头作为封面',
    exportDraft: '草稿导出',
    metaName: '项目名称',
    metaStatus: '状态',
    metaProgress: '进度',
    metaDuration: '时长',
    metaRatio: '画面比例',
    metaOutput: '成片方式',
    metaStyle: '风格',
    metaContentLocale: '内容语言',
    outputImageText: '静图成片',
    outputVideo: 'AI 视频',
    editSettings: '编辑项目设置',
    builtinPrompts: '内置提示词',
    builtinPromptsHint: '画风来自模板。角色是否出镜由 AI 按模板与主题决定；只有这里改过才覆盖本项目。',
    promptStyle: '风格',
    promptCharacter: '角色',
    promptExtra: '额外',
    promptEmpty: '（空，点击编辑）',
    aiDisclaimer: '内容由 AI 生成，请注意核对准确性',
    // 大纲 / 结构
    outline: 'AI 生成大纲',
    coreTheme: '核心主题',
    sourceScript: '完整文案',
    sourceTheme: '一句话主题',
    structure: '结构摘要',
    structureLabels: ['开端', '发展', '转折', '高潮', '结局'],
    paragraphN: '段落 {n}',
    waitingShots: '等待分镜',
    // 分镜列表
    shotList: '分镜列表（共 {n} 个场景）',
    publish: '发布',
    splitting: '正在拆分镜…',
    noShots: '暂无分镜。从风格配置页开始生成后，可先确认修改，再手动开始画面生成。',
    readyHint:
      '分镜已就绪。点表格「旁白」改口播（会同步脚本并影响整片配音），点「逐段分镜」改画面节奏与 @duration。确认后按阶段预扣：画面+配音 → 镜头视频 → 合成。',
    colScene: '场景',
    colThumb: '画面',
    colNarration: '旁白/台词',
    colSegment: '逐段分镜',
    colDuration: '时长',
    colStatus: '状态',
    colOps: '操作',
    sceneN: '场景 {n}',
    thumbGenerating: '生成中',
    thumbPending: '待出图',
    editNarrationTitle: '点击编辑旁白与标题',
    editSegmentTitle: '点击编辑逐段分镜脚本',
    moreBeats: '另有 {n} 段…',
    fillSegment: '（点击填写逐段分镜）',
    opEdit: '编辑',
    opRedraw: '重绘画面',
    opGenImage: '生成画面',
    opNeedImage: '请先生成该镜画面',
    opRegenVideo: '重生视频',
    opGenVideo: '出视频',
    opMore: '更多操作',
    opRedub: '重配音',
    footer: '总时长: {total} | 画面: {shots} 个 | 音频: {audios} 段 | 分辨率: 预览',
    exportScript: '导出分镜脚本',
    deleteProject: '删除项目',
    // 生成进度
    progress: '生成进度',
    pThemeParse: '主题解析',
    pScript: '分镜脚本',
    pImages: '画面生成 ({done}/{total})',
    pVideos: '镜头视频 ({done}/{total})',
    pAudio: '配音合成 ({done}/{total})',
    pStitch: '镜头拼接',
    pRender: '成片渲染',
    // 批量调整
    batchTitle: '批量调整分镜',
    batchSelected: '已选 {n} / {total} 个镜头',
    selectAll: '全选',
    shotItem: '镜头 {no} · {dur}',
    batchDuration: '统一时长（秒，留空则不改）',
    batchDurationPlaceholder: '例如 6',
    batchRedub: '对所选镜头重新配音',
    apply: '应用',
    cancel: '取消',
    save: '保存',
    close: '关闭',
    // 编辑镜头
    editTitleNarration: '编辑镜头 {n} · 旁白与标题',
    editTitleSegment: '编辑镜头 {n} · 逐段分镜',
    editTitleFull: '编辑镜头 {n} · 全部提示词',
    shotTitle: '镜头标题',
    shotTitleHint: '分镜列表名称；图文成片会叠到画面顶部',
    subtitle: '副标题',
    subtitleHint: '图文成片叠字；AI 视频成片不烧这行，只作分镜说明',
    narration: '旁白',
    narrationHint: '会同步到脚本旁白段，并影响整片配音（改完需重新生成配音/成片）',
    imgPrompt: '画面提示词（首帧）',
    imgPromptHint: '会同步到脚本首段画面，出图与视频都用这一段',
    segmentScript: '逐段分镜脚本（画面节奏与 @duration）',
    noDurationTags: '暂无 @duration 标签',
    durationTotal: '合计 {total}s / {max}s',
    camera: '运镜备注',
    durationSec: '时长（秒，保存后按 @duration 重算）',
    toSegment: '逐段分镜…',
    toNarration: '旁白与标题…',
    toFull: '全部字段',
    // 项目提示词
    promptModalTitle: '项目内置提示词',
    promptModalHint: '默认跟随后台模板。保存为与模板相同的内容会自动清除覆盖；已生成镜头需点重生成才会更新。',
    stylePrompt: '风格提示词',
    characterPrompt: '角色提示词',
    extraPrompt: '额外要求',
    restoreTemplate: '恢复后台模板',
    // 预览
    shotN: '镜头 {n}',
    noPreview: '暂无预览',
    captionNarration: '｜旁白：{text}',
    // 确认框
    restartTitle: '推倒重做',
    restartMessage: '将清空当前分镜与素材，重新拆分镜（生成后仍可先确认再继续）。',
    restartConfirm: '确认重做',
    restartCancel: '再想想',
    deleteTitle: '删除项目',
    deleteMessage: '确定删除该项目？素材与成片将一并清除，此操作不可恢复。',
    deleteConfirm: '删除',
    // CSV 表头
    csvHeader: ['镜号', '旁白', '画面描述', '时长秒', '状态', '镜头标题'],
    // 错误
    errContinue: '继续生成失败',
    errCompose: '合成失败',
    errRestart: '重做失败',
    errDelete: '删除失败',
    errCover: '封面上传失败',
    errNoShotImage: '暂无可用镜头画面',
    errSetCover: '设置封面失败',
    errBatchDuration: '请输入有效时长（秒）',
    errBatchNothing: '请设置时长，或勾选重配音',
    errBatch: '批量调整失败',
    errPublish: '发布失败',
    errGenImage: '生成画面失败',
    errGenVideo: '生成视频失败',
    errRedub: '重配音失败',
    errShotDuration: '分镜时长不合法',
    errSave: '保存失败',
    errSavePrompts: '保存提示词失败',
    errRestore: '恢复模板失败',
  },
  editor: {
    loading: '加载中…',
    back: '← 返回项目',
    undo: '撤销',
    redo: '重做',
    saveDraft: '保存草稿',
    playPreview: '预览播放',
    exportVideo: '导出视频',
    sceneList: '场景列表',
    addShot: '+ 添加镜头',
    shotFallback: '镜头',
    totalDuration: '总时长 {d}',
    moveUp: '上移',
    moveDown: '下移',
    shotN: '镜头 {n}',
    preview: '预览',
    uploadImage: '上传画面',
    aiRedraw: 'AI 重绘',
    noImage: '暂无画面',
    replaceHint: '可用「上传画面」替换本镜图，或「AI 重绘」按提示词重生。',
    assetTabs: ['素材库', '收藏素材', 'AI 生成素材', '我的上传'],
    assetSoon: '素材库即将推出。当前可用上方「上传画面」或「AI 重绘」替换本镜图。',
    tabs: {
      copy: '文案',
      visual: '画面',
      voice: '配音',
      transition: '转场',
    },
    copyContent: '文案内容',
    aiOptimize: 'AI 帮我优化这一镜',
    styleSettings: '样式设置',
    styleSettingsHint: '字体 / 字号 / 颜色 / 对齐占位',
    saveCopy: '保存文案',
    visualHint: '可用预览区「上传画面」替换本镜图，或「AI 重绘」按提示词重生。',
    regenShot: '重新生成当前镜头',
    voiceHint: '替换当前镜头配音（沿用项目音色）。',
    replaceVoice: '替换配音',
    transitionSoon: '转场效果（淡入淡出、闪白、运镜衔接等）即将推出。',
    applyAll: '应用到全部同类镜头',
    errLoad: '加载失败',
    errSave: '保存失败',
    errRegen: '重生成失败',
    errAddShot: '添加镜头失败',
    errReorder: '调序失败',
    errUpload: '上传画面失败',
    errExport: '导出失败',
    errRedub: '重配音失败',
  },
}
