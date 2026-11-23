"""风格模板：名称 / 简介 / 分类标签（key 为 templates_seed*.py 的中文种子文案）。

管理员改过的自定义文案在这里查不到，会原样回退显示。风格提示词不翻译。
"""

EN: dict[str, str] = {
    # ---- API 错误 ----
    "模板不存在": "Template not found",
    "模板 ID 已存在": "Template ID already exists",
    "模板仍被 {n} 个项目引用，无法删除": "The template is still used by {n} project(s) and can't be deleted",
    # ---- 名称 ----
    "开源项目展示": "Open-source project showcase",
    "真人工作场景": "Real-life workplace",
    "真人街访口播": "Street interview voice-over",
    "真人桌面演示": "Hands-on desktop demo",
    "竖屏图文故事": "Vertical illustrated story",
    "3D 动画": "3D animation",
    "真人电影感": "Live-action cinematic",
    "真人感叙事": "Live-action storytelling",
    "写实摄影": "Realistic photography",
    "电影感胶片": "Cinematic film",
    "黑色悬疑": "Noir mystery",
    "Vox剪纸科普": "Vox-style paper-cut explainer",
    "温暖纪实": "Warm documentary",
    "儿童绘本扁平": "Flat children's picture book",
    "柔光动漫": "Soft-light anime",
    "粉笔白板手绘": "Chalkboard hand-drawn",
    "赛博霓虹": "Cyber neon",
    "奇幻史诗": "Epic fantasy",
    "杂志拼贴": "Magazine collage",
    "极简品牌": "Minimalist brand",
    "像素复古科普": "Retro pixel explainer",
    "复古 VHS": "Retro VHS",
    "水墨国风": "Chinese ink painting",
    "获客·抖音钩子": "Lead-gen · TikTok hook",
    "获客·小红书安利": "Lead-gen · lifestyle recommendation",
    "获客·口碑拆解": "Lead-gen · review breakdown",
    "获客·熟人轻推": "Lead-gen · friendly nudge",
    # ---- 简介 ----
    "按项目内容动态规划：人物操作系统界面与真实使用场景，适合开源工具与平台介绍。": (
        "Planned from your project content: people operating the interface in real usage scenarios. "
        "Great for introducing open-source tools and platforms."
    ),
    "真人写实工位操作：侧脸/过肩操作系统，适合开源工具与产品工作流科普。": (
        "Realistic people at their desks, shot in profile or over the shoulder while using the software. "
        "Great for explaining open-source tools and product workflows."
    ),
    "街头/通勤场景的真人出镜口播感，适合观点、体验与轻访谈科普。": (
        "On-camera voice-over feel in street or commuting scenes. Great for opinions, experiences and light interviews."
    ),
    "桌面俯拍/斜俯写实：真人双手演示产品或笔记本流程，适合工具评测与教程。": (
        "Realistic top-down or angled desk shots of hands demonstrating a product or laptop workflow. "
        "Great for tool reviews and tutorials."
    ),
    "竖屏插画叙事，电影感构图，适合历史人文短片。": (
        "Vertical illustrated storytelling with cinematic composition. Great for history and culture shorts."
    ),
    "电影级三维动画质感，圆润造型与柔和体积光，适合科普讲解与故事短片。": (
        "Cinematic 3D animation with rounded shapes and soft volumetric light. Great for explainers and story shorts."
    ),
    "真人实拍电影质感，戏剧光影与浅景深，适合叙事短片。": (
        "Live-action cinematic look with dramatic lighting and shallow depth of field. Great for narrative shorts."
    ),
    "生活化真人出镜感，适合人物故事、口播与纪实短片。": (
        "Everyday on-camera feel. Great for personal stories, voice-overs and documentary shorts."
    ),
    "照片级写实质感，适合产品、风光与纪实科普。": (
        "Photorealistic look. Great for products, landscapes and documentary explainers."
    ),
    "宽银幕胶片质感与戏剧光影，适合叙事短片与氛围故事。": (
        "Widescreen film texture with dramatic lighting. Great for narrative shorts and moody stories."
    ),
    "高对比光影与冷调氛围，适合悬疑、案件与暗夜叙事。": (
        "High-contrast lighting and a cold mood. Great for mysteries, crime stories and night-time narratives."
    ),
    "低饱和扁平剪纸，以人物操作电脑/系统界面为主画面，适合硬核科普与产品讲解。": (
        "Low-saturation flat paper-cut style centered on people using computers and interfaces. "
        "Great for in-depth explainers and product walkthroughs."
    ),
    "纪实插画气质与暖色调，适合人物故事与人文纪录短片。": (
        "Documentary-style illustration in warm tones. Great for personal stories and cultural documentaries."
    ),
    "柔和配色与圆润造型，适合儿童科普与故事。": (
        "Soft colors and rounded shapes. Great for children's explainers and stories."
    ),
    "日系柔光赛璐璐，适合青春故事与情感短片。": (
        "Japanese soft-light cel shading. Great for youth stories and emotional shorts."
    ),
    "黑板粉笔讲解风，突出人物操作系统/画流程图的课堂演示。": (
        "Chalkboard lecture style, highlighting classroom-like demos of people using software or drawing flowcharts."
    ),
    "霓虹夜城与未来感，适合科技、都市与科幻话题。": (
        "Neon night cities with a futuristic vibe. Great for tech, urban and sci-fi topics."
    ),
    "宏大场景与奇幻光影，适合神话、冒险与世界观短片。": (
        "Grand scenes with fantasy lighting. Great for myths, adventures and world-building shorts."
    ),
    "剪报拼贴与印刷纹理，适合文化话题与品牌故事。": (
        "Clipping collage with print textures. Great for culture topics and brand stories."
    ),
    "干净色块与强留白，适合产品解说与品牌短片。": (
        "Clean color blocks and generous white space. Great for product explainers and brand shorts."
    ),
    "8-bit/16-bit 像素风，适合科技史与游戏化讲解。": (
        "8-bit/16-bit pixel art. Great for tech history and gamified explainers."
    ),
    "磁带录像与扫描线质感，适合怀旧故事与年代感内容。": (
        "Videotape and scanline texture. Great for nostalgic stories and retro content."
    ),
    "水墨留白与写意笔触，适合历史与文化短故事。": (
        "Ink wash with white space and expressive brushwork. Great for short history and culture stories."
    ),
    "竖屏口播节奏：前 3 秒钩子→场景画面→1–2 个可核验体验→到店/下单号召。适合投放获客。": (
        "Vertical voice-over pacing: a 3-second hook → scene → 1–2 verifiable experiences → a visit/order call to action. "
        "Great for paid lead-gen campaigns."
    ),
    "竖屏闺蜜安利结构：钩子标题→第一印象→分点真实体验→推荐给谁。封面信息量高、口语化。": (
        "Vertical friend-recommendation structure: hook title → first impression → real experiences point by point → "
        "who it's for. Information-rich cover, conversational tone."
    ),
    "横屏客观详实：总体评价→环境/服务→推荐项+理由→性价比→适合谁。帮别人做决策，不抒情。": (
        "Landscape, objective and detailed: overall verdict → setting/service → recommendations and reasons → "
        "value for money → who it suits. Helps people decide, no sentimentality."
    ),
    "竖屏生活化短片：一句真实感受→一个具体细节→一句轻推荐。克制、不像广告，适合转发给熟人。": (
        "Vertical everyday short: one honest feeling → one concrete detail → one light recommendation. "
        "Restrained and not ad-like, easy to share with friends."
    ),
    # ---- 分类标签 ----
    "3D": "3D",
    "像素": "Pixel",
    "儿童": "Kids",
    "写实感": "Realistic",
    "剪纸": "Paper-cut",
    "动漫": "Anime",
    "商业": "Business",
    "国风": "Chinese style",
    "图文": "Image & text",
    "复古": "Retro",
    "奇幻": "Fantasy",
    "开源": "Open source",
    "悬疑": "Mystery",
    "手绘": "Hand-drawn",
    "拼贴": "Collage",
    "摄影": "Photography",
    "故事": "Story",
    "极简": "Minimalist",
    "水墨": "Ink wash",
    "电影感": "Cinematic",
    "真人感": "Live-action",
    "科幻": "Sci-fi",
    "科普": "AI Short Video",
    "纪录片": "Documentary",
    "绘本": "Picture book",
    "胶片": "Film",
    "获客": "Lead-gen",
    "赛博": "Cyber",
}

VI: dict[str, str] = {
    "模板不存在": "Mẫu không tồn tại",
    "模板 ID 已存在": "ID mẫu đã tồn tại",
    "模板仍被 {n} 个项目引用，无法删除": "Mẫu vẫn đang được {n} dự án sử dụng, không thể xóa",
    # ---- 名称 ----
    "开源项目展示": "Giới thiệu dự án mã nguồn mở",
    "真人工作场景": "Người thật tại nơi làm việc",
    "真人街访口播": "Phỏng vấn đường phố",
    "真人桌面演示": "Người thật thao tác trên bàn",
    "竖屏图文故事": "Truyện tranh minh họa dọc",
    "3D 动画": "Hoạt hình 3D",
    "真人电影感": "Điện ảnh người thật",
    "真人感叙事": "Kể chuyện người thật",
    "写实摄影": "Nhiếp ảnh chân thực",
    "电影感胶片": "Phim nhựa điện ảnh",
    "黑色悬疑": "Trinh thám u tối",
    "Vox剪纸科普": "Khoa học phong cách cắt giấy Vox",
    "温暖纪实": "Tài liệu ấm áp",
    "儿童绘本扁平": "Sách tranh thiếu nhi phẳng",
    "柔光动漫": "Anime ánh sáng dịu",
    "粉笔白板手绘": "Vẽ phấn bảng đen",
    "赛博霓虹": "Neon cyber",
    "奇幻史诗": "Sử thi kỳ ảo",
    "杂志拼贴": "Cắt dán tạp chí",
    "极简品牌": "Thương hiệu tối giản",
    "像素复古科普": "Khoa học pixel cổ điển",
    "复古 VHS": "VHS hoài cổ",
    "水墨国风": "Thủy mặc cổ phong",
    "获客·抖音钩子": "Thu hút khách hàng · Móc câu TikTok",
    "获客·小红书安利": "Thu hút khách hàng · Chia sẻ trải nghiệm",
    "获客·口碑拆解": "Thu hút khách hàng · Phân tích đánh giá",
    "获客·熟人轻推": "Thu hút khách hàng · Gợi ý cho người quen",
    # ---- 简介 ----
    "按项目内容动态规划：人物操作系统界面与真实使用场景，适合开源工具与平台介绍。": (
        "Tự động lên kế hoạch theo nội dung dự án: người thao tác giao diện trong bối cảnh sử dụng thực tế, "
        "phù hợp giới thiệu công cụ và nền tảng mã nguồn mở."
    ),
    "真人写实工位操作：侧脸/过肩操作系统，适合开源工具与产品工作流科普。": (
        "Người thật thao tác tại bàn làm việc, góc nghiêng hoặc qua vai, phù hợp giải thích công cụ mã nguồn mở "
        "và quy trình sản phẩm."
    ),
    "街头/通勤场景的真人出镜口播感，适合观点、体验与轻访谈科普。": (
        "Cảm giác người thật lên hình thuyết minh ở đường phố hoặc khi di chuyển, phù hợp chia sẻ quan điểm, "
        "trải nghiệm và phỏng vấn nhẹ."
    ),
    "桌面俯拍/斜俯写实：真人双手演示产品或笔记本流程，适合工具评测与教程。": (
        "Góc quay từ trên xuống hoặc chéo xuống mặt bàn: đôi tay người thật trình diễn sản phẩm hoặc thao tác laptop, "
        "phù hợp đánh giá công cụ và hướng dẫn."
    ),
    "竖屏插画叙事，电影感构图，适合历史人文短片。": (
        "Kể chuyện bằng tranh minh họa khung dọc, bố cục điện ảnh, phù hợp video ngắn lịch sử và nhân văn."
    ),
    "电影级三维动画质感，圆润造型与柔和体积光，适合科普讲解与故事短片。": (
        "Chất lượng hoạt hình 3D điện ảnh, tạo hình tròn trịa và ánh sáng khối mềm mại, phù hợp video giải thích "
        "và truyện ngắn."
    ),
    "真人实拍电影质感，戏剧光影与浅景深，适合叙事短片。": (
        "Chất điện ảnh quay người thật, ánh sáng kịch tính và xóa phông, phù hợp phim ngắn kể chuyện."
    ),
    "生活化真人出镜感，适合人物故事、口播与纪实短片。": (
        "Cảm giác người thật lên hình đời thường, phù hợp câu chuyện nhân vật, thuyết minh và phim tài liệu ngắn."
    ),
    "照片级写实质感，适合产品、风光与纪实科普。": (
        "Chân thực như ảnh chụp, phù hợp sản phẩm, phong cảnh và video khoa học tài liệu."
    ),
    "宽银幕胶片质感与戏剧光影，适合叙事短片与氛围故事。": (
        "Chất phim nhựa màn ảnh rộng và ánh sáng kịch tính, phù hợp phim ngắn kể chuyện và câu chuyện giàu không khí."
    ),
    "高对比光影与冷调氛围，适合悬疑、案件与暗夜叙事。": (
        "Ánh sáng tương phản cao và tông lạnh, phù hợp chuyện trinh thám, vụ án và câu chuyện về đêm."
    ),
    "低饱和扁平剪纸，以人物操作电脑/系统界面为主画面，适合硬核科普与产品讲解。": (
        "Phong cách cắt giấy phẳng, màu nhạt, tập trung vào người thao tác máy tính/giao diện, phù hợp giải thích "
        "chuyên sâu và giới thiệu sản phẩm."
    ),
    "纪实插画气质与暖色调，适合人物故事与人文纪录短片。": (
        "Tranh minh họa phong cách tài liệu, tông màu ấm, phù hợp câu chuyện nhân vật và phim tài liệu nhân văn."
    ),
    "柔和配色与圆润造型，适合儿童科普与故事。": (
        "Màu sắc dịu nhẹ, tạo hình tròn trịa, phù hợp video khoa học và truyện cho thiếu nhi."
    ),
    "日系柔光赛璐璐，适合青春故事与情感短片。": (
        "Phong cách cel-shading Nhật Bản ánh sáng dịu, phù hợp chuyện tuổi trẻ và phim ngắn cảm xúc."
    ),
    "黑板粉笔讲解风，突出人物操作系统/画流程图的课堂演示。": (
        "Phong cách giảng bài bằng phấn trên bảng đen, nổi bật phần trình diễn như lớp học: thao tác phần mềm "
        "hoặc vẽ sơ đồ quy trình."
    ),
    "霓虹夜城与未来感，适合科技、都市与科幻话题。": (
        "Thành phố đêm neon đầy chất tương lai, phù hợp chủ đề công nghệ, đô thị và khoa học viễn tưởng."
    ),
    "宏大场景与奇幻光影，适合神话、冒险与世界观短片。": (
        "Bối cảnh hoành tráng và ánh sáng kỳ ảo, phù hợp thần thoại, phiêu lưu và video xây dựng thế giới."
    ),
    "剪报拼贴与印刷纹理，适合文化话题与品牌故事。": (
        "Cắt dán báo chí với vân in ấn, phù hợp chủ đề văn hóa và câu chuyện thương hiệu."
    ),
    "干净色块与强留白，适合产品解说与品牌短片。": (
        "Mảng màu sạch và nhiều khoảng trống, phù hợp giới thiệu sản phẩm và video thương hiệu."
    ),
    "8-bit/16-bit 像素风，适合科技史与游戏化讲解。": (
        "Phong cách pixel 8-bit/16-bit, phù hợp lịch sử công nghệ và giải thích theo lối trò chơi."
    ),
    "磁带录像与扫描线质感，适合怀旧故事与年代感内容。": (
        "Chất băng video và đường quét, phù hợp câu chuyện hoài niệm và nội dung mang màu thời đại."
    ),
    "水墨留白与写意笔触，适合历史与文化短故事。": (
        "Tranh thủy mặc với khoảng trống và nét bút phóng khoáng, phù hợp truyện ngắn lịch sử và văn hóa."
    ),
    "竖屏口播节奏：前 3 秒钩子→场景画面→1–2 个可核验体验→到店/下单号召。适合投放获客。": (
        "Nhịp thuyết minh khung dọc: móc câu 3 giây đầu → hình ảnh bối cảnh → 1–2 trải nghiệm kiểm chứng được → "
        "kêu gọi ghé cửa hàng/đặt mua. Phù hợp quảng cáo thu hút khách hàng."
    ),
    "竖屏闺蜜安利结构：钩子标题→第一印象→分点真实体验→推荐给谁。封面信息量高、口语化。": (
        "Cấu trúc chia sẻ kiểu bạn thân, khung dọc: tiêu đề móc câu → ấn tượng đầu tiên → trải nghiệm thật theo từng ý → "
        "gợi ý phù hợp cho ai. Ảnh bìa nhiều thông tin, giọng văn đời thường."
    ),
    "横屏客观详实：总体评价→环境/服务→推荐项+理由→性价比→适合谁。帮别人做决策，不抒情。": (
        "Khung ngang, khách quan và chi tiết: đánh giá tổng thể → không gian/dịch vụ → món nên thử và lý do → "
        "giá trị so với chi phí → phù hợp với ai. Giúp người xem ra quyết định, không sướt mướt."
    ),
    "竖屏生活化短片：一句真实感受→一个具体细节→一句轻推荐。克制、不像广告，适合转发给熟人。": (
        "Video ngắn đời thường khung dọc: một cảm nhận thật → một chi tiết cụ thể → một lời gợi ý nhẹ nhàng. "
        "Tiết chế, không giống quảng cáo, dễ chia sẻ cho người quen."
    ),
    # ---- 分类标签 ----
    "3D": "3D",
    "像素": "Pixel",
    "儿童": "Thiếu nhi",
    "写实感": "Chân thực",
    "剪纸": "Cắt giấy",
    "动漫": "Anime",
    "商业": "Kinh doanh",
    "国风": "Cổ phong",
    "图文": "Ảnh + chữ",
    "复古": "Hoài cổ",
    "奇幻": "Kỳ ảo",
    "开源": "Mã nguồn mở",
    "悬疑": "Trinh thám",
    "手绘": "Vẽ tay",
    "拼贴": "Cắt dán",
    "摄影": "Nhiếp ảnh",
    "故事": "Câu chuyện",
    "极简": "Tối giản",
    "水墨": "Thủy mặc",
    "电影感": "Điện ảnh",
    "真人感": "Người thật",
    "科幻": "Viễn tưởng",
    "科普": "Video ngắn AI",
    "纪录片": "Tài liệu",
    "绘本": "Sách tranh",
    "胶片": "Phim nhựa",
    "获客": "Thu hút khách hàng",
    "赛博": "Cyber",
}
