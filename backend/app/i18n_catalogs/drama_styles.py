"""内置画面风格展示名译文（key 为 image_styles.IMAGE_STYLE_LABELS 中文名；与前端 lib 风格名一致）。"""

EN: dict[str, str] = {
    "复古科幻原子朋克": "Retro sci-fi atompunk",
    "宫斗权谋冷峻": "Cold palace intrigue",
    "国产悬疑冷调": "Cold-toned Chinese suspense",
    "古偶唯美柔光": "Soft-lit period romance",
    "中国古代神话史诗": "Ancient Chinese mythology epic",
    "日式青春胶片": "Japanese youth film",
    "日式生活自然": "Natural Japanese slice of life",
    "韩剧都市柔光": "Soft-lit Korean drama urban",
    "国产都市写实": "Realistic Chinese urban",
    "武侠江湖写实摄影": "Realistic wuxia photography",
    "90年代写实电影": "90s realistic film",
    "复古叙事电影": "Retro narrative film",
    "美式复古好莱坞": "Retro American Hollywood",
    "霓虹赛博电影": "Neon cyberpunk film",
    "90年代中国农村电影": "90s rural China film",
    "3D 动画": "3D animation",
    "宫崎骏气质手绘": "Ghibli-style hand-drawn",
    "手冢治虫时代卡通画风": "Tezuka-era cartoon",
    "上美画风": "Shanghai Animation Studio style",
    "像素风": "Pixel art",
    "皮影戏插画": "Shadow puppet illustration",
    # 视频被 PrivacyInformation 拒收且项目为写实风格时的补充建议
    "当前项目画面风格「{style}」是真人写实风格，Seedance 容易把这类角色图判为真人而拒绝生成；建议在项目设置里换成插画/动画类风格（如 3D 动画、宫崎骏气质手绘），重新生成角色图后再生成视频": (
        "The project style \"{style}\" is photorealistic, and Seedance often rejects such character images as real people. "
        "Switch the project to an illustrated/animated style (e.g. 3D animation, Ghibli-style hand-drawn), "
        "regenerate the character images, then generate the video again"
    ),
}

VI: dict[str, str] = {
    "复古科幻原子朋克": "Khoa học viễn tưởng cổ điển atompunk",
    "宫斗权谋冷峻": "Cung đấu mưu quyền lạnh lùng",
    "国产悬疑冷调": "Trinh thám Trung Quốc tông lạnh",
    "古偶唯美柔光": "Cổ trang ngôn tình ánh sáng dịu",
    "中国古代神话史诗": "Sử thi thần thoại Trung Hoa cổ đại",
    "日式青春胶片": "Phim thanh xuân Nhật Bản",
    "日式生活自然": "Đời thường Nhật Bản tự nhiên",
    "韩剧都市柔光": "Đô thị phim Hàn ánh sáng dịu",
    "国产都市写实": "Đô thị Trung Quốc tả thực",
    "武侠江湖写实摄影": "Nhiếp ảnh võ hiệp tả thực",
    "90年代写实电影": "Phim tả thực thập niên 90",
    "复古叙事电影": "Phim tự sự cổ điển",
    "美式复古好莱坞": "Hollywood cổ điển kiểu Mỹ",
    "霓虹赛博电影": "Phim cyberpunk neon",
    "90年代中国农村电影": "Phim nông thôn Trung Quốc thập niên 90",
    "3D 动画": "Hoạt hình 3D",
    "宫崎骏气质手绘": "Vẽ tay phong cách Ghibli",
    "手冢治虫时代卡通画风": "Hoạt hình thời Tezuka",
    "上美画风": "Phong cách xưởng phim Thượng Hải",
    "像素风": "Pixel art",
    "皮影戏插画": "Minh họa múa rối bóng",
    # 视频被 PrivacyInformation 拒收且项目为写实风格时的补充建议
    "当前项目画面风格「{style}」是真人写实风格，Seedance 容易把这类角色图判为真人而拒绝生成；建议在项目设置里换成插画/动画类风格（如 3D 动画、宫崎骏气质手绘），重新生成角色图后再生成视频": (
        "Phong cách hiện tại của dự án «{style}» là tả thực, Seedance dễ coi ảnh nhân vật kiểu này là người thật và từ chối tạo; "
        "hãy vào cài đặt dự án đổi sang phong cách minh họa/hoạt hình (vd. Hoạt hình 3D, Vẽ tay phong cách Ghibli), "
        "tạo lại ảnh nhân vật rồi tạo video lại"
    ),
}
