"""内置模板视觉提示词的英文版（越南语 / 英语内容项目使用）。

key = templates_seed*.py 里的中文原文（style_prefix / negative_prompt / seedream_config.character_prompt /
seedream_config.extra_prompt / seedance_config.motion_bias / audio_config.bgm_mood），
value = 给 Seedream / Seedance 的英文提示词。管理员改过的文案查不到时原样回退。

另含流水线/兜底生成的固定片段（mock 分镜、运镜、BGM 氛围等）。
"""

from __future__ import annotations

from typing import Any

from app.i18n import normalize_locale

PROMPTS_EN: dict[str, str] = {
    # ---- opensource_showcase ----
    "高品质产品演示静帧：人物在真实工位前操作软件/文档站/工作台，手部点击与屏幕界面清晰，排版克制、信息层级清楚，材质与配色由内容决定（浅色SaaS、纸感文档、深色IDE、终端均可），电影级产品演示质感，干净留白便于叠字，非任务清单界面": (
        "High-quality product demo still: a person at a real workstation using software / a docs site / a dashboard, "
        "hand clicks and screen UI clearly visible, restrained layout with a clear information hierarchy, materials and "
        "colors driven by the content (light SaaS, paper-like docs, dark IDE or terminal all fine), cinematic product-demo "
        "quality, clean negative space for text overlays, not a to-do list UI"
    ),
    "任务列表，todolist，勾选框，看板卡片堆叠，霓虹蓝，赛博朋克蓝光，全屏蓝紫渐变，发光网格地板，科幻HUD堆叠，卡通夸张，动漫美少女，手绘潦草，画面乱码文字，字幕水印，logo乱码，模糊，空界面无操作者，纯抽象色块": (
        "task list, todo list, checkboxes, stacked kanban cards, neon blue, cyberpunk blue glow, full-screen blue-purple "
        "gradient, glowing grid floor, stacked sci-fi HUD, exaggerated cartoon, anime girl, sloppy hand drawing, garbled "
        "text, subtitle watermark, garbled logo, blur, empty UI with no operator, pure abstract color blocks"
    ),
    "产品演示操作员：侧脸或过肩视角，坐在工位前操作笔记本电脑或双屏，商务休闲着装，手部与屏幕为视觉重点，五官不必抢戏，全片气质统一": (
        "Product demo operator: profile or over-the-shoulder view, seated at a desk using a laptop or dual monitors, "
        "business-casual clothing, hands and screen are the visual focus, face understated, consistent look throughout"
    ),
    "主体为人操作系统界面，手部点击可读，禁止霓虹蓝赛博大屏；顶部与底部留白便于叠大字，画面内不要出现任何文字；本镜布局与操作动作须与其他镜头明显不同": (
        "The subject is a person operating a software interface with readable hand clicks, no neon-blue cyber big screens; "
        "leave space at the top and bottom for large text overlays, no text of any kind in the frame; this shot's layout "
        "and action must clearly differ from other shots"
    ),
    "手部轻微点击与屏幕内容切换，缓慢推近工位": "Subtle hand clicks and screen content changes, slow push-in toward the desk",
    "轻快专业": "light, upbeat and professional",
    # ---- opensource_live_work ----
    "真人写实摄影，真实办公室工位，侧脸或过肩视角操作笔记本电脑/双屏，手部点击与屏幕界面清晰，自然窗光与显示器补光，商务休闲着装，皮肤与材质真实，非卡通非动漫，干净留白便于叠字": (
        "Realistic live-action photography at a real office desk, profile or over-the-shoulder view using a laptop / dual "
        "monitors, hand clicks and screen UI clearly visible, natural window light plus monitor fill light, business-casual "
        "clothing, realistic skin and materials, not cartoon or anime, clean negative space for text overlays"
    ),
    "卡通，动漫，赛璐璐，二次元，美颜过度磨皮，CGI假人，霓虹蓝赛博大屏，任务清单堆叠，空界面无操作者，画面文字水印，模糊": (
        "cartoon, anime, cel shading, 2D anime style, over-smoothed beauty filter skin, CGI mannequin, neon-blue cyber big "
        "screen, stacked task lists, empty UI with no operator, on-screen text watermark, blur"
    ),
    "写实产品演示操作员：侧脸或过肩，坐在工位前操作笔记本或双屏，商务休闲着装，手部与屏幕为视觉重点，五官不抢戏，气质全片统一": (
        "Realistic product demo operator: profile or over the shoulder, seated at a desk using a laptop or dual monitors, "
        "business-casual clothing, hands and screen are the visual focus, face understated, consistent look throughout"
    ),
    "真人写实工位，手部点击可读，界面类型随内容变化；禁止正脸大特写与霓虹赛博大屏；画面内不要出现文字": (
        "Realistic live-action workstation with readable hand clicks, interface type follows the content; no frontal "
        "face close-ups and no neon cyber big screens; no text in the frame"
    ),
    # ---- live_street_interview ----
    "真人纪实街访摄影，自然光与轻微手持感，城市街道或通勤场景，真实皮肤与环境噪音感克制，非棚拍浓妆，非卡通非动漫": (
        "Live-action documentary street-interview photography, natural light with a slight handheld feel, city streets or "
        "commuting scenes, realistic skin with restrained environmental grit, not studio heavy makeup, not cartoon or anime"
    ),
    "卡通，动漫，赛璐璐，二次元，棚拍浓妆，CGI假人，霓虹赛博，画面文字水印": (
        "cartoon, anime, cel shading, 2D anime style, studio heavy makeup, CGI mannequin, neon cyber, on-screen text watermark"
    ),
    "真人街访主角：年龄气质、发型服装日常感固定，自然表情，全片同一人": (
        "Street-interview host: fixed age, vibe, hairstyle and everyday clothing, natural expressions, the same person throughout"
    ),
    "自然光街景或通勤场景，竖屏主体清晰，顶部可留白叠字": (
        "Natural-light street or commuting scene, clear subject in vertical framing, space at the top for text overlays"
    ),
    "轻微手持感，缓慢推近": "Slight handheld feel, slow push-in",
    "温暖人文": "warm and human",
    # ---- live_product_desk ----
    "真人桌面产品演示摄影，斜俯或过肩，木质/浅色桌面，笔记本与手部清晰，柔和棚灯或窗光，材质真实，非卡通非插画": (
        "Live-action desktop product demo photography, high angle or over the shoulder, wooden / light-colored desk, laptop "
        "and hands clearly visible, soft studio light or window light, realistic materials, not cartoon or illustration"
    ),
    "卡通，动漫，赛璐璐，二次元，空桌无手，霓虹赛博，画面乱码文字水印": (
        "cartoon, anime, cel shading, 2D anime style, empty desk with no hands, neon cyber, garbled on-screen text watermark"
    ),
    "写实双手与小臂为主，可露侧脸；着装简洁，全片气质统一": (
        "Mainly realistic hands and forearms, profile may be visible; simple clothing, consistent look throughout"
    ),
    "桌面斜俯，手部与产品/屏幕清晰，画面内无文字": (
        "High-angle desk view, hands and product / screen clearly visible, no text in the frame"
    ),
    "手部点击滑动，轻微推近屏幕": "Hands clicking and swiping, slight push-in toward the screen",
    "冷静纪实": "calm documentary",
    # ---- portrait_story ----
    "统一二维概念插画，细腻光影与电影感构图，非写实摄影、非日系赛璐璐动漫，竖屏主体偏中下，顶部留白便于叠字，画面干净无文字": (
        "Consistent 2D concept illustration, delicate lighting and cinematic composition, not realistic photography, not "
        "Japanese cel-shaded anime, vertical framing with the subject slightly low, space at the top for text overlays, "
        "clean frame with no text"
    ),
    "写实照片，真人，真实人脸，摄影棚，电影真人剧照，日系动漫赛璐璐，画面文字，字幕，水印，标题字，logo，模糊": (
        "realistic photo, real person, real human face, photo studio, live-action movie still, Japanese cel-shaded anime, "
        "on-screen text, subtitles, watermark, title text, logo, blur"
    ),
    "故事主角外形固定：年龄感、发型发色、服装配色与辨识物全片一致，细腻插画五官，非真人照片": (
        "Fixed protagonist design: age, hairstyle and hair color, outfit colors and signature items stay the same throughout, "
        "finely illustrated facial features, not a real photo"
    ),
    "竖屏构图，主体偏中下，顶部约1/4留白，电影感光影，画面内无文字": (
        "Vertical composition, subject slightly low, about 1/4 empty space at the top, cinematic lighting, no text in the frame"
    ),
    "缓慢推近或轻拉远": "Slow push-in or gentle pull-out",
    "叙事氛围": "narrative ambience",
    # ---- anim_3d ----
    "电影级三维动画渲染，皮克斯/梦工厂气质，圆润造型与清晰轮廓，柔和体积光与次表面散射，干净材质与饱和配色，浅景深，非写实摄影、非日系赛璐璐平面、非剪纸扁平": (
        "Cinematic 3D animation render with a Pixar / DreamWorks feel, rounded shapes and clean silhouettes, soft volumetric "
        "light and subsurface scattering, clean materials and saturated colors, shallow depth of field, not realistic "
        "photography, not flat Japanese cel shading, not flat paper-cut"
    ),
    "写实照片，真人皮肤毛孔，摄影棚实拍，日系赛璐璐，二次元平涂，剪纸扁平，像素风，手绘潦草，血腥恐怖，水印，画面文字，字幕乱码": (
        "realistic photo, real skin pores, studio live-action shoot, Japanese cel shading, flat 2D anime coloring, flat "
        "paper-cut, pixel art, sloppy hand drawing, gore or horror, watermark, on-screen text, garbled subtitles"
    ),
    "固定 3D 动画角色：圆润比例、简洁五官、识别度高的发型发色与服装配色，塑料感柔和皮肤与布料材质，全片同一人物设定": (
        "Fixed 3D animated character: rounded proportions, simple facial features, distinctive hairstyle, hair color and "
        "outfit colors, soft plastic-like skin and fabric materials, the same character design throughout"
    ),
    "三维渲染体积光，干净材质，饱和但不刺眼，主体清晰，画面内不要出现文字；可留白便于叠字": (
        "3D-rendered volumetric light, clean materials, saturated but not harsh, clear subject, no text in the frame; "
        "leave some space for text overlays"
    ),
    "轻微布料与发丝飘动，缓慢推近，动画感运镜平滑": (
        "Subtle cloth and hair movement, slow push-in, smooth animated camera motion"
    ),
    # ---- live_cinematic ----
    "真人电影感摄影，电影级打光与浅景深，胶片质感与轻微颗粒，青橙调色，写实皮肤与真实材质，宽银幕构图，非卡通非动漫": (
        "Live-action cinematic photography, film-grade lighting and shallow depth of field, film texture with light grain, "
        "teal-and-orange grading, realistic skin and materials, widescreen composition, not cartoon or anime"
    ),
    "卡通，动漫，赛璐璐，二次元，扁平插画，剪纸，像素，夸张五官，塑料皮肤，水印，画面文字": (
        "cartoon, anime, cel shading, 2D anime style, flat illustration, paper-cut, pixel art, exaggerated features, "
        "plastic skin, watermark, on-screen text"
    ),
    "真人演员外形固定：年龄、发型发色、面部特征、服装全片一致，写实皮肤质感": (
        "Fixed live-action actor: age, hairstyle and hair color, facial features and clothing stay the same throughout, "
        "realistic skin texture"
    ),
    "电影打光、浅景深、胶片颗粒，真实场景材质": (
        "Cinematic lighting, shallow depth of field, film grain, realistic set materials"
    ),
    "电影感推轨或轻微横移，自然运动模糊": "Cinematic dolly or gentle lateral move, natural motion blur",
    "电影氛围": "cinematic ambience",
    # ---- live_person ----
    "真人感生活摄影，自然光与柔和环境光，真实人物五官与皮肤质感，纪实构图，非棚拍浓妆，非卡通非动漫": (
        "Live-action lifestyle photography, natural and soft ambient light, real facial features and skin texture, "
        "documentary composition, not studio heavy makeup, not cartoon or anime"
    ),
    "卡通，动漫，赛璐璐，二次元，美颜过度磨皮，CGI假人，扁平插画，水印，画面文字": (
        "cartoon, anime, cel shading, 2D anime style, over-smoothed beauty filter skin, CGI mannequin, flat illustration, "
        "watermark, on-screen text"
    ),
    "真人出镜主角：年龄气质、发型发色、服装日常感固定，自然表情，全片同一人": (
        "On-camera protagonist: fixed age, vibe, hairstyle, hair color and everyday clothing, natural expressions, the same "
        "person throughout"
    ),
    "自然光、生活场景、竖屏主体清晰，顶部可留白叠字": (
        "Natural light, everyday scenes, clear subject in vertical framing, space at the top for text overlays"
    ),
    # ---- photo_realism ----
    "照片级写实摄影，清晰细节与真实材质，自然色彩，高动态范围，微距或风光皆可，非卡通非插画非动漫": (
        "Photorealistic photography, crisp detail and real materials, natural colors, high dynamic range, macro or landscape "
        "both fine, not cartoon, illustration or anime"
    ),
    "卡通，动漫，赛璐璐，扁平插画，油画笔触，剪纸，像素，过度HDR伪色，水印，画面文字": (
        "cartoon, anime, cel shading, flat illustration, oil-paint strokes, paper-cut, pixel art, overdone HDR false color, "
        "watermark, on-screen text"
    ),
    "若出现人物：写实五官与发型服装固定；若无人物则专注真实场景与材质": (
        "If people appear: fixed realistic features, hairstyle and clothing; if not, focus on real scenes and materials"
    ),
    "照片级细节、真实材质、自然色彩，清晰主体": (
        "Photographic detail, real materials, natural colors, clear subject"
    ),
    "缓慢推近或轻微横移，真实空间感": "Slow push-in or gentle lateral move, real sense of space",
    # ---- film_cinematic ----
    "电影感概念插画，宽银幕构图，胶片颗粒与轻微暗角，戏剧光影（侧光/逆光），青橙调色倾向，浅景深氛围，非写实摄影、非赛璐璐动漫": (
        "Cinematic concept illustration, widescreen composition, film grain and a slight vignette, dramatic lighting "
        "(side light / backlight), teal-and-orange tendency, shallow-depth mood, not realistic photography, not cel-shaded anime"
    ),
    "写实照片，真人，真实人脸，日系动漫，赛璐璐，扁平贴纸风，过曝，水印，画面文字，卡通简笔画": (
        "realistic photo, real person, real human face, Japanese anime, cel shading, flat sticker style, overexposure, "
        "watermark, on-screen text, simple cartoon doodle"
    ),
    "电影感插画主角，明确年龄与发型发色，服装轮廓与辨识物固定，面部细节适中非照片，全片同一人设": (
        "Cinematic illustrated protagonist with a clear age, hairstyle and hair color, fixed outfit silhouette and "
        "signature items, moderate facial detail and not photographic, the same character throughout"
    ),
    "胶片颗粒、暗角、戏剧光影，青橙氛围，宽银幕主体明确": (
        "Film grain, vignette, dramatic lighting, teal-and-orange mood, clear subject in widescreen"
    ),
    "缓慢推轨或轻微横移，电影感运镜，避免抖动": (
        "Slow dolly or gentle lateral move, cinematic camera motion, no shake"
    ),
    # ---- noir_thriller ----
    "黑色电影概念插画，高对比明暗交界，冷青灰与少量暖光点缀，雨夜或室内台灯氛围，剪影与侧脸，非写实摄影": (
        "Film-noir concept illustration, high-contrast light and shadow, cold teal-gray with a few warm highlights, rainy "
        "night or desk-lamp interior mood, silhouettes and profiles, not realistic photography"
    ),
    "明亮粉彩，儿童绘本，日系美少女，写实照片，真人，血腥特写，水印，画面文字": (
        "bright pastels, children's picture book, anime girl, realistic photo, real person, gory close-up, watermark, "
        "on-screen text"
    ),
    "Noir 风插画角色，轮廓清晰，大衣或标志性剪影，面部少光，外形全片一致": (
        "Noir-style illustrated character, clear silhouette, trench coat or signature outline, face mostly in shadow, "
        "consistent look throughout"
    ),
    "高对比阴影、冷调、雨夜或台灯，强构图张力": (
        "High-contrast shadows, cold tones, rainy night or desk lamp, strong compositional tension"
    ),
    "极慢推近，烟雾或雨丝轻微飘动": "Very slow push-in, drifting smoke or rain",
    "悬疑低沉": "suspenseful and low",
    # ---- vox_papercut ----
    "Vox剪纸扁平插画，层叠剪纸边缘，低饱和，干净剪影，科普解说片气质；画面以人物操作电脑或业务系统为主：工位前操作、手指点击界面、多屏监控、配置参数、流程演示，屏幕与手部动作清晰，信息图表为辅": (
        "Vox-style flat paper-cut illustration, layered paper edges, low saturation, clean silhouettes, explainer-video "
        "feel; frames mainly show people using computers or business systems: working at a desk, fingers clicking the UI, "
        "multi-screen monitoring, configuring settings, walking through a process, with clear screen and hand actions and "
        "infographics as support"
    ),
    "写实照片，真人照片级皮肤，三维写实渲染，日系动漫，模糊，噪点，水印，画面乱码文字，空镜风景无人物无界面，纯抽象色块无操作场景": (
        "realistic photo, photographic human skin, realistic 3D render, Japanese anime, blur, noise, watermark, garbled "
        "on-screen text, empty landscape with no people or UI, pure abstract color blocks with no operation scene"
    ),
    "固定剪纸操作员：简洁人形剪影、低细节面部、工装或休闲色块服装固定，常坐工位前操作笔记本电脑或双屏控制台，发型与配色全片一致": (
        "Fixed paper-cut operator: simple human silhouette, low-detail face, fixed workwear or casual color-block outfit, "
        "usually seated at a desk using a laptop or dual-screen console, hairstyle and colors consistent throughout"
    ),
    "主体为人操作电脑/系统界面，屏幕区块与点击手势可读，层叠纸片边缘清晰，低饱和，单镜一个视觉焦点，避免写实皮肤": (
        "The subject is a person using a computer / system interface, readable screen blocks and click gestures, crisp "
        "layered paper edges, low saturation, one visual focus per shot, avoid realistic skin"
    ),
    "手部轻微点击与光标移动感，屏幕内容轻切换，缓慢推近工位": (
        "Subtle hand clicks and cursor movement, light screen content changes, slow push-in toward the desk"
    ),
    "好奇纪录片": "curious documentary",
    # ---- docu_warm ----
    "温暖纪实概念插画，自然光感，柔和暖棕与米白，生活场景细节，纪录片构图，非写实照片、非动漫赛璐璐": (
        "Warm documentary concept illustration, natural light feel, soft warm browns and off-white, everyday scene details, "
        "documentary composition, not realistic photos, not cel-shaded anime"
    ),
    "赛博霓虹，日系美少女，血腥，夸张卡通，写实照片，真人，水印，画面文字": (
        "cyber neon, anime girl, gore, exaggerated cartoon, realistic photo, real person, watermark, on-screen text"
    ),
    "纪实插画人物，生活化发型服装，亲切五官，年龄感明确，全片同一人设": (
        "Documentary-style illustrated character, everyday hairstyle and clothing, friendly features, clear age, the same "
        "character throughout"
    ),
    "暖色自然光，生活场景，纪录片式构图，柔和颗粒": (
        "Warm natural light, everyday scenes, documentary-style composition, soft grain"
    ),
    "手持感极轻晃动或缓慢横移，纪实运镜": (
        "Very light handheld sway or slow lateral move, documentary camera work"
    ),
    # ---- kids_flat ----
    "儿童绘本扁平插画，柔和粉彩，圆润造型，友好角色，简洁背景": (
        "Flat children's picture-book illustration, soft pastels, rounded shapes, friendly characters, simple backgrounds"
    ),
    "恐怖，阴暗，写实照片，复杂纹理，血腥": "horror, gloomy, realistic photo, complex textures, gore",
    "圆润可爱卡通角色，大眼睛简化五官，柔和配色服装，友好表情，全片同一角色外形": (
        "Round, cute cartoon character with big eyes and simplified features, soft-colored clothing, friendly expression, "
        "the same character design throughout"
    ),
    "粉彩柔光，背景简洁，造型圆润，适合儿童观看": (
        "Pastel soft light, simple background, rounded shapes, suitable for children"
    ),
    "轻微弹跳感，柔和镜头漂移": "Light bouncy feel, gentle camera drift",
    "俏皮轻快": "playful and bouncy",
    # ---- soft_anime ----
    "日系柔光赛璐璐动漫，干净线稿，柔和渐变天空，大眼睛精致五官，统一角色设定，非写实摄影、非水墨、非剪纸": (
        "Japanese soft-light cel-shaded anime, clean line art, soft gradient skies, big eyes and delicate features, "
        "consistent character design, not realistic photography, not ink wash, not paper-cut"
    ),
    "写实照片，真人，真实人脸，水墨，剪纸，像素风，血腥恐怖，水印，画面文字，三头身Q版混用": (
        "realistic photo, real person, real human face, ink wash, paper-cut, pixel art, gore or horror, watermark, "
        "on-screen text, mixed-in chibi proportions"
    ),
    "日系动漫主角，发型发色瞳色固定，校服或常服配色固定，赛璐璐五官，全片同一人设": (
        "Japanese anime protagonist with fixed hairstyle, hair color and eye color, fixed school-uniform or casual outfit "
        "colors, cel-shaded features, the same character throughout"
    ),
    "柔光、干净线稿、柔和天空，统一赛璐璐上色": (
        "Soft light, clean line art, soft skies, consistent cel-shaded coloring"
    ),
    "轻微发丝与衣袂飘动，缓慢推近": "Subtle hair and clothing movement, slow push-in",
    "青春轻音乐": "light youthful music",
    # ---- chalk_whiteboard ----
    "黑板粉笔与白板手绘讲解风，粉笔笔触，示意图箭头；画面常含简笔人物在白板或电脑前操作系统、画流程、指点界面": (
        "Chalkboard and whiteboard hand-drawn lecture style, chalk strokes, diagram arrows; frames often include simple "
        "stick figures at a whiteboard or computer operating software, drawing flows or pointing at the interface"
    ),
    "写实照片，光滑三维，杂乱界面，空教室无人物": (
        "realistic photo, glossy 3D, cluttered interface, empty classroom with no people"
    ),
    "粉笔简笔讲解者/操作员，线条简洁特征固定，常站在白板前或坐在电脑前指点界面": (
        "Chalk stick-figure presenter / operator with simple, fixed line features, usually standing at a whiteboard or "
        "seated at a computer pointing at the interface"
    ),
    "黑板/白板底，人物操作系统或画流程图，箭头清晰，教学感构图": (
        "Chalkboard / whiteboard background, a person operating software or drawing a flowchart, clear arrows, "
        "classroom-style composition"
    ),
    "手部指点与线条逐步显现，镜头基本固定或轻推": (
        "Hand pointing while lines appear step by step, mostly static camera or a gentle push-in"
    ),
    "专注氛围": "focused ambience",
    # ---- cyber_neon ----
    "赛博朋克概念插画，霓虹粉青对比，雨夜反光街道，未来都市剪影，高对比夜景，非写实摄影、非儿童绘本": (
        "Cyberpunk concept illustration, neon pink-and-cyan contrast, rain-slick reflective streets, futuristic city "
        "silhouettes, high-contrast night scene, not realistic photography, not a children's picture book"
    ),
    "日光沙滩，田园水彩，儿童粉彩，写实照片，真人，水墨留白，水印，画面文字": (
        "sunny beach, pastoral watercolor, children's pastels, realistic photo, real person, ink-wash negative space, "
        "watermark, on-screen text"
    ),
    "赛博风插画角色，外套剪裁与发色固定，霓虹边缘光，面部非照片，全片同一人设": (
        "Cyber-style illustrated character with a fixed jacket cut and hair color, neon rim light, non-photographic face, "
        "the same character throughout"
    ),
    "霓虹粉青、雨夜反光、未来都市，强对比夜景": (
        "Neon pink and cyan, rainy-night reflections, futuristic city, high-contrast night scene"
    ),
    "霓虹闪烁，雨丝下落，缓慢穿梭运镜": "Flickering neon, falling rain, slow gliding camera",
    "赛博电子": "cyber electronic",
    # ---- epic_fantasy ----
    "奇幻史诗概念插画，宏大远景与英雄中景，暮光与神性光束，岩石城堡与云海，戏剧构图，非写实摄影、非现代都市": (
        "Epic fantasy concept illustration, grand wide shots and heroic medium shots, twilight and divine light rays, rocky "
        "castles and seas of clouds, dramatic composition, not realistic photography, not a modern city"
    ),
    "现代城市，手机界面，写实照片，真人，儿童简笔画，赛博霓虹，水印，画面文字": (
        "modern city, phone UI, realistic photo, real person, children's doodle, cyber neon, watermark, on-screen text"
    ),
    "奇幻主角外形固定：盔甲或斗篷轮廓、发色、武器辨识物全片一致，插画五官非照片": (
        "Fixed fantasy hero design: armor or cloak silhouette, hair color and signature weapon stay the same throughout, "
        "illustrated non-photographic features"
    ),
    "宏大场景、暮光神性光束、戏剧构图，史诗氛围": (
        "Grand scenes, twilight divine light rays, dramatic composition, epic atmosphere"
    ),
    "缓慢升降镜头，云雾与旗帜飘动": "Slow crane move, drifting clouds and fluttering banners",
    "史诗管弦": "epic orchestral",
    # ---- magazine_collage ----
    "杂志纸质拼贴，撕边，网纹印刷质感，层叠剪贴，大胆平面构图": (
        "Magazine paper collage, torn edges, halftone print texture, layered cutouts, bold graphic composition"
    ),
    "纯净矢量，写实皮肤，脏污发灰的色彩": "clean vector, realistic skin, dirty grayish colors",
    "杂志剪贴人像剪影或印刷半调人物，外形与配色全片统一": (
        "Magazine cutout portrait silhouettes or halftone printed figures, consistent shape and colors throughout"
    ),
    "撕边纸质、网纹印刷、大胆色块，竖屏强构图": (
        "Torn paper edges, halftone printing, bold color blocks, strong vertical composition"
    ),
    "图层轻微滑动旋转，纸张沙沙感": "Layers gently sliding and rotating, rustling-paper feel",
    "时髦轻电子": "trendy light electronic",
    # ---- brand_clean ----
    "极简品牌概念插画，大面积留白，有限色板（黑白+一强调色），几何构图，干净产品感，非写实摄影、非杂乱拼贴": (
        "Minimalist brand concept illustration, large negative space, limited palette (black and white plus one accent "
        "color), geometric composition, clean product feel, not realistic photography, not cluttered collage"
    ),
    "杂乱纹理，霓虹赛博，血腥，儿童粉彩堆砌，写实照片，真人，水印，画面乱文字": (
        "cluttered textures, neon cyber, gore, piled-up children's pastels, realistic photo, real person, watermark, "
        "messy on-screen text"
    ),
    "极简几何化人物或手部剪影，配色固定，低细节面部，全片外形一致": (
        "Minimal geometric figures or hand silhouettes, fixed colors, low-detail faces, consistent look throughout"
    ),
    "大留白、有限色板、几何构图，竖屏品牌感": (
        "Generous negative space, limited palette, geometric composition, vertical brand feel"
    ),
    "色块轻移，极慢推近，干净无抖动": "Color blocks shifting slightly, very slow push-in, clean and steady",
    "极简电子": "minimal electronic",
    # ---- pixel_retro ----
    "复古像素画，16位有限色板，清晰像素块，简单游戏场景，无抗锯齿": (
        "Retro pixel art, limited 16-bit palette, crisp pixel blocks, simple game scenes, no anti-aliasing"
    ),
    "平滑渐变，写实照片，模糊像素": "smooth gradients, realistic photo, blurry pixels",
    "16位像素小人操作员，坐在电脑前，有限色板，外形与调色全片不变": (
        "16-bit pixel operator character seated at a computer, limited palette, look and colors unchanged throughout"
    ),
    "像素小人操作系统界面，清晰像素块，无抗锯齿，游戏关卡式场景": (
        "Pixel character operating an interface, crisp pixel blocks, no anti-aliasing, game-level style scenes"
    ),
    "逐帧点击与屏幕切换，轻微视差滚动": "Frame-by-frame clicks and screen changes, light parallax scrolling",
    "8位好奇": "curious 8-bit",
    # ---- retro_vhs ----
    "复古 VHS 概念插画，轻微色差与扫描线暗示，1980–90s 色调，圆角电视框感构图，怀旧氛围，非写实照片、非现代超清UI": (
        "Retro VHS concept illustration, slight chromatic aberration and hinted scanlines, 1980s–90s palette, rounded "
        "TV-frame composition, nostalgic mood, not realistic photos, not modern ultra-sharp UI"
    ),
    "超清现代广告，赛博霓虹堆砌，写实照片，真人，儿童粉彩，水印，画面乱码文字": (
        "ultra-sharp modern ads, piled-up cyber neon, realistic photo, real person, children's pastels, watermark, "
        "garbled on-screen text"
    ),
    "怀旧风插画人物，年代感发型服装固定，轻微色差边缘，非照片，全片同一人设": (
        "Nostalgic illustrated character with a fixed period hairstyle and clothing, slight chromatic-aberration edges, "
        "not photographic, the same character throughout"
    ),
    "扫描线暗示、轻微色差、80/90年代色调，怀旧构图": (
        "Hinted scanlines, slight chromatic aberration, 80s/90s palette, nostalgic composition"
    ),
    "轻微磁带抖动感，慢推，色差微闪": "Slight tape-wobble feel, slow push-in, subtle chromatic flicker",
    "怀旧合成器": "nostalgic synth",
    # ---- ink_guofeng ----
    "中国水墨写意插画，富有表现力的笔触，大量留白，诗意氛围，淡雅墨色，非写实摄影": (
        "Chinese freehand ink-wash illustration, expressive brushstrokes, generous negative space, poetic mood, soft "
        "elegant ink tones, not realistic photography"
    ),
    "写实照片，真人，真实人脸，霓虹，赛博朋克，日系动漫，欧美卡通，画面文字，字幕，水印": (
        "realistic photo, real person, real human face, neon, cyberpunk, Japanese anime, Western cartoon, on-screen text, "
        "subtitles, watermark"
    ),
    "水墨写意人物，简笔眉眼，宽袍或古装轮廓固定，墨色淡雅，全片同一人设": (
        "Freehand ink-wash character with simple brows and eyes, fixed wide-robe or traditional costume silhouette, soft "
        "ink tones, the same character throughout"
    ),
    "大量留白，淡墨渲染，诗意意境，竖屏顶部可叠字": (
        "Generous negative space, light ink wash, poetic mood, space at the top of the vertical frame for text"
    ),
    "墨晕渗开与消散，缓慢升降镜头，薄雾飘动": "Ink blooming and fading, slow crane move, drifting mist",
    "古筝氛围": "guzheng ambience",
    # ---- huoke_douyin_hook ----
    "竖屏获客短视频静帧：门店外立面、产品特写、服务动作或操作界面交替出现，强对比自然光，主体清晰、留白便于叠大字，电影级产品演示质感，非卡通非动漫": (
        "Vertical lead-gen short video still: storefront exteriors, product close-ups, service actions or interfaces in "
        "alternation, high-contrast natural light, clear subject with negative space for large text, cinematic "
        "product-demo quality, not cartoon or anime"
    ),
    "卡通，动漫，赛璐璐，二次元，霓虹赛博大屏，任务清单，画面乱码文字，字幕水印，logo 乱码，虚假奖杯证书，夸张促销海报堆叠": (
        "cartoon, anime, cel shading, 2D anime style, neon cyber big screen, task list, garbled on-screen text, subtitle "
        "watermark, garbled logo, fake trophies or certificates, piled-up flashy promo posters"
    ),
    "竖屏主体清晰，顶部与底部留白叠字；各镜构图必须不同；画面内不要出现文字": (
        "Clear subject in vertical framing, space at the top and bottom for text overlays; every shot must be composed "
        "differently; no text in the frame"
    ),
    "轻微手持推进，产品或门店细节切换": "Slight handheld push-in, cutting between product or store details",
    # ---- huoke_xhs_recommend ----
    "竖屏生活安利静帧：明亮自然光，浅色桌面或门店角落，产品/空间细节清楚，杂志封面气质、留白分层，适合叠标题，非浓妆棚拍、非卡通": (
        "Vertical lifestyle recommendation still: bright natural light, light-colored tabletop or store corner, clear "
        "product / space details, magazine-cover feel with layered negative space for titles, not studio heavy makeup, "
        "not cartoon"
    ),
    "阴暗脏乱，赛博霓虹，卡通动漫，硬广海报堆字，假抠图，水印乱码": (
        "dark and messy, cyber neon, cartoon or anime, hard-sell poster crammed with text, fake cutouts, garbled watermark"
    ),
    "明亮竖屏，顶部大留白叠标题，画面内不要出现文字，各镜场景不同": (
        "Bright vertical frame, large space at the top for a title, no text in the frame, a different scene in every shot"
    ),
    "缓慢平移与轻微推近细节": "Slow pan and a gentle push-in on details",
    # ---- huoke_review_facts ----
    "干净讲解静帧：浅色桌面或门店信息分区，产品/空间/价目氛围（无可读文字），信息层级清楚、光线均匀，纪录片式克制，非卡通非霓虹": (
        "Clean explainer still: light tabletop or organized store areas, product / space / price-list mood (no readable "
        "text), clear information hierarchy, even lighting, restrained documentary style, not cartoon, not neon"
    ),
    "卡通，动漫，夸张表情包，霓虹赛博，假证书奖杯，画面乱码文字，促销爆炸贴": (
        "cartoon, anime, exaggerated meme faces, neon cyber, fake certificates or trophies, garbled on-screen text, "
        "promo starburst stickers"
    ),
    "横屏讲解构图，左右或上下留白叠字，画面内不要出现文字，各镜明显不同": (
        "Landscape explainer composition with space left/right or top/bottom for text, no text in the frame, every shot "
        "clearly different"
    ),
    "缓慢推近产品或空间细节": "Slow push-in on product or space details",
    # ---- huoke_soft_invite ----
    "竖屏生活纪实静帧：窗光、街角、桌面一角或门店日常，暖色克制，真实材质与皮肤，像随手拍的一张，非棚拍硬广、非卡通": (
        "Vertical everyday documentary still: window light, a street corner, a tabletop corner or daily store life, "
        "restrained warm tones, real materials and skin, like a casual snapshot, not a studio hard-sell ad, not cartoon"
    ),
    "棚拍浓妆，硬广海报，卡通动漫，霓虹赛博，假笑模特，水印乱码，爆炸贴": (
        "studio heavy makeup, hard-sell poster, cartoon or anime, neon cyber, fake-smiling model, garbled watermark, "
        "starburst stickers"
    ),
    "生活感路人视角，可露侧脸或只出手部与场景，着装日常，全片气质统一": (
        "Everyday passer-by perspective, may show a profile or only hands and surroundings, everyday clothing, "
        "consistent look throughout"
    ),
    "暖色窗光，竖屏生活感，顶部可留白，画面内不要出现文字": (
        "Warm window light, everyday vertical feel, space at the top, no text in the frame"
    ),
    "轻微手持呼吸感，缓慢平移": "Slight handheld breathing feel, slow pan",
    # ---- 运镜 / BGM 兜底 ----
    "缓慢推近": "slow push-in",
    "轻拉远": "gentle pull-out",
    "缓慢横移": "slow lateral move",
    "平稳": "steady",
    "neutral": "neutral",
}

# seedance_segments BGM 氛围（按关键词推断）的英文版
BGM_MOODS_EN: dict[str, str] = {
    "贴合内容的轻量配乐，情绪平稳，不抢旁白": "light music that fits the content, steady mood, never over the narration",
    "低沉紧张、鼓点渐强，烘托压迫感，音量低于人声": "low and tense with building drums, heightening pressure, below the voice",
    "温暖人文、钢琴弦乐铺底，音量低于人声": "warm and human, piano and strings bed, below the voice",
    "轻电子氛围，克制不抢戏，音量低于人声": "light electronic tech ambience, restrained, below the voice",
    "轻快专业、干净电子铺底，音量低于人声": "light, upbeat and professional with a clean electronic bed, below the voice",
    "史诗弦乐铺底，气势克制，音量低于人声": "epic strings bed, restrained grandeur, below the voice",
}


def prompt_en(text: str | None) -> str:
    """中文模板提示词 → 英文；查不到（管理员自定义 / 已是英文）原样返回。"""
    raw = text or ""
    key = raw.strip()
    if not key:
        return raw
    return PROMPTS_EN.get(key) or BGM_MOODS_EN.get(key) or raw


def localize_prompt(text: str | None, locale: str | None) -> str:
    """zh 原样返回；vi / en 内容用英文模板提示词。"""
    if normalize_locale(locale, "zh") == "zh":
        return text or ""
    return prompt_en(text)


def localize_template_prompt_fields(data: dict[str, Any], locale: str | None) -> dict[str, Any]:
    """把模板 dict 里的视觉提示词字段换成英文（返回新 dict，不改原对象）。"""
    if normalize_locale(locale, "zh") == "zh":
        return data
    out = dict(data)
    for key in ("style_prefix", "negative_prompt"):
        if isinstance(out.get(key), str):
            out[key] = prompt_en(out[key])
    for cfg_key, fields in (
        ("seedream_config", ("character_prompt", "extra_prompt")),
        ("seedance_config", ("motion_bias",)),
        ("audio_config", ("bgm_mood",)),
    ):
        cfg = out.get(cfg_key)
        if isinstance(cfg, dict):
            cfg = dict(cfg)
            for f in fields:
                if isinstance(cfg.get(f), str):
                    cfg[f] = prompt_en(cfg[f])
            out[cfg_key] = cfg
    return out
