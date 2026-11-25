/** vi: lib 命名空间（t('lib.xxx')） */

export const viLib = {
  listSep: ', ',
  agentSkill: {
    none: 'Không dùng Skill',
  },
  media: {
    untitled: 'Chưa đặt tên',
  },
  voice: {
    emptyPrompt: 'Mô tả giọng đọc đang trống',
    synthFailed: 'Tổng hợp giọng đọc thất bại',
    defaultCharacter: 'Nhân vật',
    assetName: 'Giọng đọc {name}',
  },
  compose: {
    clipLabel: 'Phân cảnh {n}',
    thisEpisode: 'Tập',
    fullSuffix: 'toan-tap',
    serverNoUrl: 'Máy chủ ghép video nhưng không trả về địa chỉ tải xuống',
    noClips: 'Tập này chưa có video phân cảnh nào để ghép',
    notMp4: '{name} không phải MP4 có thể ghép',
    codecMismatch:
      'Các cảnh quay dùng mã hóa khác nhau nên không thể ghép không suy hao trên trình duyệt. Hãy tạo lại bằng cùng mô hình, tỉ lệ khung hình và độ phân giải rồi thử lại.',
    reasonSuffix: ' ({reason})',
  },
  assetImage: {
    generate: 'Tạo hình tượng',
    regenerate: 'Tạo lại hình tượng',
    version: {
      upload: 'Tải lên',
      replaced: 'Đã bị thay',
      generate: 'Đã tạo',
      restored: 'Khôi phục',
      history: 'Lịch sử',
    },
  },
  camera: {
    items: {
      empty: { label: 'Cảnh trống', insert: 'Cảnh trống: ', hint: 'Thiết lập bối cảnh, không thoại, không lời dẫn' },
      wide: { label: 'Viễn cảnh', insert: 'Viễn cảnh: ', hint: 'Cho thấy quan hệ không gian' },
      full: { label: 'Toàn cảnh', insert: 'Toàn cảnh: ', hint: 'Toàn thân và môi trường trong khung' },
      medium: { label: 'Trung cảnh', insert: 'Trung cảnh: ', hint: 'Từ eo trở lên, hay dùng cho lời thoại' },
      close: { label: 'Cận cảnh', insert: 'Cận cảnh: ', hint: 'Từ ngực trở lên, gần cảm xúc' },
      closeup: { label: 'Đặc tả', insert: 'Đặc tả: ', hint: 'Khuôn mặt hoặc đạo cụ quan trọng' },
      ecu: { label: 'Đại đặc tả', insert: 'Đại đặc tả: ', hint: 'Mắt, tay, chi tiết' },
      establish: { label: 'Cảnh thiết lập', insert: 'Cảnh thiết lập: ', hint: 'Mở đầu, xác lập bối cảnh và không khí' },
      atmosphere: { label: 'Cảnh không khí', insert: 'Cảnh không khí: ', hint: 'Ánh sáng, thời tiết, đồ vật tạo không khí' },
      push: { label: 'Đẩy máy', insert: 'Đẩy máy: ', hint: 'Máy quay tiến lại gần chủ thể' },
      pull: { label: 'Kéo máy', insert: 'Kéo máy: ', hint: 'Máy quay lùi ra, mở rộng không gian' },
      pan: { label: 'Lia máy', insert: 'Lia máy: ', hint: 'Máy đứng yên, quét ngang/dọc' },
      truck: { label: 'Dịch máy', insert: 'Dịch máy: ', hint: 'Máy quay trượt ngang để theo' },
      follow: { label: 'Máy theo', insert: 'Máy theo: ', hint: 'Đi theo nhân vật di chuyển' },
      high: { label: 'Góc cao', insert: 'Góc cao: ', hint: 'Nhìn từ trên xuống' },
      low: { label: 'Góc thấp', insert: 'Góc thấp: ', hint: 'Nhìn từ dưới lên' },
      aerial: { label: 'Flycam', insert: 'Flycam: ', hint: 'Toàn cảnh nhìn từ trên cao' },
    },
    tips: {
      formula: 'Công thức: chủ thể + hành động + bối cảnh + (cỡ cảnh/chuyển động máy) + (ánh sáng)',
      axes: 'Mỗi đoạn tối đa 2 trục chuyển động (đẩy + lia được; đẩy + lia + nâng dễ mất kiểm soát)',
      rotation: 'Xoay mạnh ở cận cảnh dễ méo mặt; quay vòng nên dùng từ trung cảnh trở lên',
      visualOnly: 'Cảnh trống/cỡ cảnh phải viết dạng hình ảnh, không được đánh dấu là lời thoại hay lời dẫn',
    },
  },
  rhythm: {
    breath: { label: 'Nhịp thở', hint: 'Vào chậm — mở ra — lắng xuống, hợp cảnh mở đầu và trữ tình' },
    heartbeat: { label: 'Nhịp tim', hint: 'Ngắn và dồn dập, hợp cảnh xung đột, đối đầu' },
    wave: { label: 'Sóng biển', hint: 'Dâng từng lớp rồi xả, hợp cảnh cao trào' },
    elastic: { label: 'Thời gian co giãn', hint: 'Kéo dài hành động chính, nén phần còn lại' },
    pulse: { label: 'Nhịp xung', hint: 'Nhịp đều, hợp cắt theo nhạc và cảnh tập thể' },
    silence_hammer: { label: 'Lặng rồi đập', hint: 'Lặng dồn nén rồi cắt mạnh, hợp cảnh đảo ngược' },
  },
  promptEditor: {
    assetInitial: 'T',
    durationChipTitle: 'Thời lượng {seconds}s, bấm để đổi khi chỉnh sửa',
  },
  scriptValidate: {
    segmentRange: 'Mỗi @duration phải nằm trong khoảng {min}–{max} giây',
    segmentOverSuggest: 'Một số @duration vượt mức khuyến nghị {max}s cho phân cảnh mới; bản cũ vẫn có thể tạo',
    totalOverHard: 'Tổng @duration của cảnh này là {total}s, vượt giới hạn Seedance {max}s',
    totalOverSuggest: 'Tổng @duration của cảnh này là {total}s, vượt mức khuyến nghị {max}s (bản cũ vẫn có thể tạo)',
    visualAsVoice:
      'Phát hiện cảnh trống/cỡ cảnh bị đánh dấu là lời thoại hoặc lời dẫn (sẽ bị đọc và in phụ đề). Hãy viết lại thành dòng chỉ có hình ảnh, ví dụ “Cảnh trống: …”',
    missingImage: 'Các tài nguyên sau chưa có ảnh tham chiếu, khi tạo có thể tự bổ sung ảnh hoặc kết quả không ổn định: {names}',
    missingVoice: 'Kịch bản có lời thoại nhưng các nhân vật sau chưa gắn giọng đọc: {names}',
    mustFix: '[Cần sửa trước]',
    shouldFix: '[Nên xử lý, vẫn có thể tiếp tục]',
  },
  segment: {
    totalOver: 'Tổng thời lượng cảnh quay không được vượt quá {max} giây (hiện tại {total}s)',
    placeholderBgm: '【BGM: phối sau · nhẹ nhàng chuyên nghiệp, nhỏ hơn giọng nói】',
    placeholderVisual: 'Cảnh qua vai, người đang thao tác tại bàn làm việc…',
    placeholderNarration: 'Nội dung lời thuyết minh…',
  },
  subtitle: {
    empty: 'Chưa có phụ đề để xuất',
    narration: 'Lời dẫn',
    innerMonologue: 'Độc thoại nội tâm',
    speakerSep: ': ',
  },
  visualPrompt: {
    identity: 'Thân phận: {v}',
    role: 'Vai trò: {v}',
    tags: 'Đặc điểm: {v}',
    personality: 'Tính cách: {v}',
    scene: 'Bối cảnh: {name}, bối cảnh chân thực chuẩn điện ảnh, bố cục rõ ràng, phù hợp phim ngắn',
    sep: '. ',
  },
  roleType: {
    femaleLead: 'Nữ chính',
    maleLead: 'Nam chính',
    keySupporting: 'Vai phụ quan trọng',
    lead: 'Vai chính',
    supporting: 'Vai phụ',
    villain: 'Phản diện',
    extras: 'Quần chúng',
    cameo: 'Khách mời',
    narrator: 'Người dẫn chuyện',
  },
  genQueue: {
    assetTitle: 'Tài nguyên {id}',
    videoTitle: 'Video {id}',
    segmentLabel: 'Đoạn {n}',
    fragmentVideo: 'Video phân cảnh',
    canvasVideo: 'Video canvas',
    imageRunning: 'Đang tạo ảnh',
    videoRunning: 'Đang tạo video',
    queued: 'Đang chờ',
    generating: 'Đang tạo',
    refImages: 'Đang tạo ảnh tham chiếu…',
    enqueued: 'Đã vào hàng đợi',
    interrupted: 'Tác vụ bị gián đoạn, vui lòng tạo lại',
    cancelled: 'Đã hủy',
    assetNotFound: 'Không tìm thấy tài nguyên',
    imageCancelled: 'Đã hủy tạo ảnh',
    imageFailed: 'Tạo ảnh thất bại',
    imageTimeout: 'Tạo ảnh quá thời gian, hãy tải lại trang rồi thử lại',
    videoFailed: 'Tạo video thất bại',
    videoTimeout: 'Tạo video quá thời gian, hãy tải lại trang rồi thử lại',
  },
  genOptions: {
    auto: 'Tự động',
    imageModel: 'Mô hình ảnh',
    videoModel: 'Mô hình video',
  },
  steps: {
    outline: 'Dàn ý',
    storyboard: 'Phân cảnh',
    video: 'Tạo video',
  },
  usage: {
    calls: '{n} lượt gọi',
    images: '{n} ảnh',
    videos: '{n} video',
  },
  workflow: {
    freeCanvas: 'Canvas tự do',
    cardCanvas: 'Canvas tự do · {n} tài nguyên nút',
    cardScript: 'Đã có kịch bản · {episodes} tập · {assets} tài nguyên',
    cardDraft: 'Bản nháp · chưa có kịch bản · {n} tài nguyên',
  },
  imageStyles: {
    'retro-sci-fi-atompunk': 'Khoa học viễn tưởng cổ điển atompunk',
    'palace-intrigue-cold': 'Cung đấu mưu quyền lạnh lùng',
    'domestic-suspense-cold': 'Trinh thám Trung Quốc tông lạnh',
    'ancient-romance-soft': 'Cổ trang ngôn tình ánh sáng dịu',
    'ancient-chinese-mythology': 'Sử thi thần thoại Trung Hoa cổ đại',
    'japanese-youth-film': 'Phim thanh xuân Nhật Bản',
    'japanese-daily-natural': 'Đời thường Nhật Bản tự nhiên',
    'korean-urban-soft': 'Đô thị phim Hàn ánh sáng dịu',
    'chinese-urban-realistic': 'Đô thị Trung Quốc tả thực',
    'wuxia-realistic-photo': 'Nhiếp ảnh võ hiệp tả thực',
    '90s-realistic-film': 'Phim tả thực thập niên 90',
    'retro-narrative-film': 'Phim tự sự cổ điển',
    'american-retro-hollywood': 'Hollywood cổ điển kiểu Mỹ',
    'neon-cyberpunk-film': 'Phim cyberpunk neon',
    '90s-rural-china-film': 'Phim nông thôn Trung Quốc thập niên 90',
    'cgi-3d-animation': 'Hoạt hình 3D',
    'ghibli-handdrawn-anime': 'Vẽ tay phong cách Ghibli',
    'tezuka-era-cartoon': 'Hoạt hình thời Tezuka',
    'shanghai-animation': 'Phong cách xưởng phim Thượng Hải',
    'pixel-art': 'Pixel art',
    'shadow-puppet-illustration': 'Minh họa múa rối bóng',
  },
  genError: {
    failedTitle: 'Tạo thất bại',
    shortSuggestion: 'Hãy xử lý theo gợi ý rồi tạo lại phân cảnh này.',
    fallbackSuggestion: 'Hãy kiểm tra ảnh tham chiếu và kịch bản của cảnh này rồi thử lại.',
    namedSlot: '{kind} “{name}”',
    slot: {
      character: 'Nhân vật',
      scene: 'Bối cảnh',
      prop: 'Đạo cụ',
      narration: 'Lời dẫn',
      refImage: 'Ảnh tham chiếu',
      voice: 'Giọng đọc',
    },
    empty: {
      message: 'Tác vụ không hoàn thành và không ghi lại lỗi cụ thể.',
      suggestion:
        'Hãy thử lại sau; nếu lỗi lặp lại, kiểm tra mạng/proxy có truy cập được TokenFree không và khóa kênh mô hình trong trang quản trị.',
    },
    timeout: {
      title: 'Dịch vụ thượng nguồn phản hồi quá thời gian',
      suggestion:
        'Đã kết nối được TokenFree nhưng thời gian chờ tạo ảnh/video vượt giới hạn. Hãy thử lại sau; nếu tạo văn bản được mà chỉ ảnh/video bị quá thời gian, thường do hàng đợi thượng nguồn chậm, không phải proxy mất kết nối.',
    },
    network: {
      title: 'Không kết nối được dịch vụ ảnh/video',
      suggestion:
        'Máy hiện không kết nối được dịch vụ thượng nguồn (thường do proxy chặn hoặc mất mạng). Hãy kiểm tra mạng/proxy rồi thử lại, và xác nhận khóa kênh TokenFree trong trang quản trị còn hiệu lực.',
    },
    imageFailed: {
      title: 'Tạo ảnh thất bại',
      message: 'Tạo ảnh không thành công, nhưng tác vụ cũ không lưu nguyên nhân (thường do lỗi kết nối thượng nguồn với thông báo lỗi trống).',
      suggestion: 'Hãy tạo lại một lần; phiên bản mới sẽ ghi rõ lỗi. Nếu vẫn lỗi, kiểm tra mạng và khóa TokenFree.',
    },
    upstreamAccount: {
      title: 'Tài khoản thượng nguồn của nền tảng bị nợ phí',
      message:
        'Tài khoản mô hình Seedream thượng nguồn không đủ số dư nên yêu cầu tạo ảnh bị từ chối. Đây là tài khoản thượng nguồn của hệ thống, không phải số dư ví của bạn.',
      suggestion: 'Hãy liên hệ quản trị viên nạp tiền trong bảng điều khiển TokenFree; sau khi nạp xong hãy thử tạo ảnh lại.',
    },
    billing: {
      title: 'Số dư không đủ',
      message: 'Số dư hiện tại không đủ để tiếp tục tạo.',
      suggestion: 'Hãy nạp tiền rồi thử lại tác vụ này.',
    },
    realPerson: {
      title: 'Ảnh tham chiếu nghi có người thật',
      namedMessage:
        'Dịch vụ video từ chối khi kiểm duyệt: ảnh tham chiếu của {kind} “{name}” có thể chứa chân dung người thật nên đã bị từ chối tạo.',
      namedSuggestion:
        'Mở “{name}” trong mục tài nguyên bên trái, tạo lại hoặc tải lên hình tượng theo phong cách anime/minh họa rồi tạo lại phân cảnh này.',
      whereIndex: ' (mục thứ {n} được gửi / content[{idx}], thường là ảnh tham chiếu nhân vật hoặc bối cảnh)',
      whereAny: ' (một ảnh tham chiếu)',
      message: 'Dịch vụ video từ chối khi kiểm duyệt: ảnh đầu vào{where} có thể chứa chân dung người thật nên đã bị từ chối tạo.',
      suggestion:
        'Mở mục tài nguyên bên trái, dùng AI tạo lại hình tượng anime/minh họa cho nhân vật/bối cảnh liên quan (tránh ảnh chụp người thật), hoặc tải lên ảnh hợp lệ rồi tạo lại phân cảnh này.',
    },
    retryLimit: {
      title: 'Vẫn thất bại sau nhiều lần tạo',
      suggestion:
        'Số lần tự thử lại trong cùng tác vụ đã hết, bạn vẫn có thể bấm tạo lại. Hãy sửa tài nguyên hoặc nội dung theo nguyên nhân thực (thường là kiểm duyệt người thật trên ảnh tham chiếu) rồi bấm tạo lại.',
    },
    prevShot: {
      title: 'Không nối được với cảnh trước',
      message: 'Cảnh này cần nối từ khung hình cuối của cảnh trước, nhưng cảnh trước chưa thành công nên cảnh này chưa bắt đầu tạo.',
      suggestion: 'Hãy sửa và tạo lại cảnh trước bị lỗi, sau đó tạo các đoạn tiếp theo theo thứ tự.',
    },
    storyboardChanged: {
      title: 'Phân cảnh đã được cập nhật',
      message: 'Phân cảnh đã được lưu hoặc chia lại trong lúc tạo, tác vụ cũ không còn hiệu lực.',
      suggestion: 'Hãy quay lại trang tập phim và bấm tạo theo danh sách phân cảnh hiện tại; đừng thử lại tác vụ cũ.',
    },
    textSensitive: {
      title: 'Nội dung không qua kiểm duyệt',
      message: 'Kịch bản phân cảnh hoặc prompt đã kích hoạt kiểm duyệt an toàn nội dung.',
      suggestion: 'Hãy sửa các cách diễn đạt nhạy cảm trong phân cảnh rồi thử lại.',
    },
    audioDownload: {
      title: 'Không tải được âm thanh tham chiếu',
      message: 'Địa chỉ tệp giọng đọc tham chiếu không hợp lệ hoặc tạm thời không truy cập được.',
      suggestion: 'Hãy kiểm tra âm thanh nghe thử đã gắn với nhân vật, tạo lại hoặc đổi giọng đọc rồi thử lại.',
    },
    audioShort: {
      title: 'Âm thanh tham chiếu quá ngắn',
      whereIndex: 'mục thứ {n} được gửi / content[{idx}] (âm thanh tham chiếu, không phải ảnh)',
      whereAny: 'một giọng đọc nhân vật/lời dẫn',
      message: 'Dịch vụ video yêu cầu âm thanh tham chiếu dài ít nhất 1,8 giây, hiện quá ngắn: {where}.',
      suggestion:
        'Mở tài nguyên nhân vật hoặc lời dẫn tương ứng bên trái, tạo lại/tải lên âm thanh nghe thử dài hơn (khuyến nghị ≥ 2 giây) rồi tạo lại phân cảnh này. Đây không phải lỗi ảnh tham chiếu.',
    },
    aspect: {
      title: 'Tỉ lệ khung hình không tương thích',
      message: 'Khi tạo video từ ảnh chỉ với khung hình đầu, kênh video hiện tại có thể từ chối tỉ lệ cố định.',
      suggestion: 'Hãy tạo lại phân cảnh này; máy chủ sẽ tự điều chỉnh tỉ lệ theo ảnh tham chiếu.',
    },
    credits: {
      title: 'Kênh video không đủ điểm',
      message: 'Tài khoản thượng nguồn không đủ điểm để tạo tác vụ video (không phải lỗi ảnh tham chiếu hay độ dài âm thanh).',
      suggestion: 'Hãy liên hệ quản trị viên nạp tiền trong bảng điều khiển TokenFree rồi tạo lại phân cảnh này.',
    },
    fileType: {
      title: 'Định dạng ảnh tham chiếu không được hỗ trợ',
      message: 'Dịch vụ thượng nguồn từ chối ảnh tham chiếu: File type not supported (thường do ảnh giữ chỗ SVG hoặc không phải ảnh bitmap).',
      suggestion:
        'Kiểm tra ảnh bìa nhân vật/bối cảnh/đạo cụ dùng trong cảnh này có phải PNG/JPG/WEBP không. Nếu vẫn là ảnh giữ chỗ SVG, hãy tạo lại ảnh hoặc tải lên ảnh bitmap cho tài nguyên đó rồi tạo video.',
    },
    rejected: {
      title: 'Dịch vụ video từ chối yêu cầu',
      whereNamed: ' ({where})',
      whereIndex: ' (mục thứ {n} được gửi / content[{idx}])',
      message: 'Dịch vụ thượng nguồn báo lỗi tham số hoặc nội dung, không tạo được tác vụ{where}.',
      suggestion:
        'Hãy kiểm tra ảnh tham chiếu, độ dài âm thanh tham chiếu (phải ≥ 1,8 giây) và kịch bản của cảnh này rồi thử lại; nếu vẫn lỗi, liên hệ hỗ trợ kèm mã tác vụ.',
    },
    videoFailed: {
      title: 'Tạo video thất bại',
      suggestion: 'Có thể thử lại phân cảnh này sau; nếu lỗi liên tục, hãy đổi ảnh tham chiếu hoặc rút gọn kịch bản.',
    },
    skipped: {
      title: 'Đã bỏ qua tác vụ cũ',
      message: 'Bộ lập lịch thấy phân cảnh này đã có video nên đã hủy tác vụ cũ bị xếp hàng trùng.',
      suggestion:
        'Nếu bạn đang “tạo lại”, hãy xem hàng đợi còn tác vụ mới đang chạy không; nếu không có thì bấm tạo lại lần nữa. Đừng coi lần hủy cũ này là lỗi hiện tại.',
    },
    cancelled: {
      title: 'Đã hủy',
      suggestion: 'Khi cần video, hãy đưa vào hàng đợi để tạo lại.',
    },
    interrupted: {
      title: 'Tác vụ bị gián đoạn',
    },
  },
}
