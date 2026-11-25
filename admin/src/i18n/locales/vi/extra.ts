// 与上游合并时新增的文案（自动生成后可手工整理进各命名空间）
export const viExtra = {
  "common": {
    "pagination": {
      "perPageAria": "Số mục mỗi trang",
      "nav": "Điều hướng phân trang",
      "pageN": "Trang {n}"
    },
    "dateRange": {
      "label": "Khoảng ngày",
      "start": "Ngày bắt đầu",
      "end": "Ngày kết thúc",
      "to": "đến"
    },
    "userSearch": {
      "matching": "Người dùng phù hợp",
      "find": "Tìm người dùng",
      "count": "{n} người",
      "listLabel": "Tìm người dùng",
      "failed": "Tìm kiếm thất bại, hãy nhập lại rồi thử lại",
      "hint": "Nhập email, biệt danh hoặc ID tài khoản để tìm",
      "select": "chọn"
    },
    "secret": {
      "statusClearPending": "Sẽ xóa sau khi lưu",
      "statusDraft": "Khóa mới chờ lưu",
      "statusNotConfigured": "Chưa cấu hình",
      "onlySpaces": "Khóa bí mật không được chỉ gồm khoảng trắng.",
      "guideClearPending": "Hiện chỉ đánh dấu xóa, có hiệu lực sau khi lưu; có thể hoàn tác.",
      "guideNew": "Nhập khóa mới rồi lưu; nút hiển thị chỉ hiện giá trị vừa nhập.",
      "markedClear": "Đã đánh dấu xóa",
      "hideLabel": "Ẩn {label} mới",
      "showLabel": "Hiện {label} mới",
      "hideInput": "Ẩn giá trị vừa nhập",
      "showInput": "Hiện giá trị vừa nhập",
      "undo": "Hoàn tác"
    }
  },
  "labels": {
    "payType": {
      "stripe": "Thẻ ngân hàng · Stripe"
    }
  },
  "settings": {
    "saveBar": {
      "saveCurrent": "Lưu cài đặt hiện tại",
      "savingSettings": "Đang lưu cài đặt…",
      "saveSection": "Lưu phần hiện tại",
      "hint": "Các thay đổi trên trang này có hiệu lực sau khi lưu thành công."
    },
    "oss": {
      "marketplaceNote": "Chợ tài sản số luôn dùng thư mục marketplace/ (không phụ thuộc thư mục bên dưới); tệp được tải lên ở chế độ riêng tư và truy cập qua chữ ký ngắn hạn. Bucket phải ở chế độ riêng tư, trang này không tự đổi quyền Bucket."
    },
    "runtime": {
      "form": {
        "defaultsTitle": "Mặc định khi tạo",
        "defaultsDesc": "Đặt chất lượng, khung hình và thời lượng mặc định cho tác vụ tạo mới; phạm vi hỗ trợ thực tế vẫn do mô hình đã chọn quyết định.",
        "imageSizeHint": "Dùng kích thước thượng nguồn hỗ trợ, ví dụ 2K hoặc 1024x1024.",
        "videoQualityHint": "Ví dụ 480p, 720p; theo giá trị mô hình hiện tại hỗ trợ.",
        "videoRatioHint": "Rộng:cao, ví dụ 16:9 hoặc 9:16.",
        "egValue": "Ví dụ {v}",
        "seedanceMinHint": "Không nhỏ hơn 1 giây; cùng thời lượng tối đa giới hạn độ dài mỗi đoạn.",
        "seedanceMaxHint": "Không nhỏ hơn thời lượng tối thiểu; vẫn bị giới hạn bởi phạm vi của mô hình.",
        "unitSec": "giây",
        "unitItem": "tác vụ",
        "unitLane": "luồng",
        "unitTimes": "lần",
        "errSeconds": "Hãy nhập số giây lớn hơn 0",
        "errMinOne": "Hãy nhập số nguyên không nhỏ hơn 1",
        "errInteger": "Hãy nhập số nguyên",
        "errMaxLtMin": "Thời lượng tối đa không được nhỏ hơn tối thiểu",
        "errTimeout": "Thời gian chờ phải lớn hơn chu kỳ thăm dò",
        "errRequired": "Hãy nhập giá trị mặc định",
        "saveLabel": "Lưu cài đặt vận hành",
        "concTitle": "Đồng thời tác vụ",
        "concDesc": "Kiểm soát số tác vụ chạy đồng thời và tài nguyên mỗi người dùng được chiếm.",
        "globalSlotsHint": "Số tác vụ Worker chạy đồng thời toàn hệ thống, không nhỏ hơn 1.",
        "userSlotsHint": "Số tác vụ một người dùng được chiếm, vẫn bị giới hạn bởi khe toàn hệ thống.",
        "dramaVideoLimitHint": "Giới hạn tổng số tác vụ video đang chờ và đang xử lý, không nhỏ hơn 1.",
        "draftPrefix": "Bản nháp hiện tại: toàn hệ thống",
        "draftMid": "khe thực thi, mỗi người dùng tối đa",
        "draftSuffix": "; tác vụ chờ thăm dò thượng nguồn không chiếm khe Worker.",
        "advTitle": "Tham số vận hành nâng cao",
        "advDesc": "Phân bổ quy trình, thăm dò và chế độ mô phỏng",
        "pipelineTitle": "Quy trình tạo",
        "pipelineDesc": "Kiểm soát số xử lý song song cho từng loại tác vụ media; đều là số nguyên không nhỏ hơn 1.",
        "imageConcHint": "Số tác vụ ảnh xử lý đồng thời.",
        "videoConcHint": "Số tác vụ video xử lý đồng thời.",
        "ttsConcHint": "Số tác vụ lồng tiếng xử lý đồng thời.",
        "pollTitle": "Thăm dò thượng nguồn & thử lại",
        "pollDesc": "Cân bằng giữa tần suất truy vấn và thời gian chờ; thời gian chờ phải lớn hơn chu kỳ truy vấn.",
        "pollIntervalHint": "Lớn hơn 0 giây; chu kỳ càng ngắn, truy vấn thượng nguồn càng dày.",
        "pollTimeoutHint": "Lớn hơn chu kỳ thăm dò; quá thời gian này sẽ dừng chờ.",
        "selectorConcHint": "Số truy vấn không chặn tối đa mỗi vòng Selector, không nhỏ hơn 1.",
        "fragmentAttemptsHint": "Bao gồm lần tạo đầu và các lần thử lại khi lỗi, không nhỏ hơn 1.",
        "devTitle": "Phát triển & gỡ lỗi",
        "devDesc": "Chuyển cách chạy các yêu cầu tạo nội dung."
      }
    },
    "site": {
      "saveLabel": "Lưu cài đặt trang",
      "mp": {
        "marketplace": "Chợ tài sản số",
        "appVideo": "Video trên App",
        "panelTitle": "3. Chợ tài sản số",
        "panelDesc": "Bật lối vào tại đây khi môi trường production không có tệp cấu hình",
        "enable": "Bật chợ tài sản số",
        "enableDesc": "Sau khi lưu, phía người dùng hiện «Chợ tài sản số», trang quản trị mục «Kinh doanh» hiện «Vận hành chợ tài sản số». Tải lên vẫn dùng «Lưu trữ OSS».",
        "appEnable": "Bật dịch vụ video App",
        "appEnableDesc": "Sau khi lưu sẽ mở danh sách và phát video trên App. Bật/tắt tại đây, không cần đổi biến môi trường container. Cần bật chợ tài sản số cùng lúc.",
        "maxDuration": "Thời lượng tối đa của video đầy đủ",
        "maxDurationHint": "Đơn vị giây. Mặc định 1800 (30 phút). Dùng chung cho tải lên, ghép và phát đầy đủ trên App. Xem thử tối đa 15 giây và không quá 30% thời lượng gốc.",
        "shareTitle": "4. Tương tác App & chia sẻ tác phẩm",
        "shareDesc": "Số lượng khởi tạo, chia sẻ thật và liên kết iOS / Android đều cấu hình tại đây, không cần sửa tệp môi trường.",
        "socialInit": "Tự khởi tạo số lượt tương tác",
        "socialInitDesc": "Tạo số liệu ban đầu một lần cho video đơn và tập mới lên kệ đủ điều kiện hiển thị trên App. Tác phẩm cũ hãy bổ sung hàng loạt ở trang vận hành tác phẩm; tắt không xóa số liệu đã lưu.",
        "sharing": "Bật chia sẻ tác phẩm",
        "sharingDesc": "Cho phép chia sẻ liên kết video đơn và tập phim hiện tại. Cần tên miền HTTPS công khai hợp lệ, không dùng localhost hay địa chỉ mạng nội bộ.",
        "shareBase": "Địa chỉ gốc chia sẻ công khai",
        "shareBaseHint": "Ví dụ https://www.printfilm.com; tên miền cần chuyển /s/, /.well-known/apple-app-site-association và /.well-known/assetlinks.json về backend, các trang tác phẩm còn lại do Web xử lý.",
        "teamIdHint": "Team ID trong tài khoản Apple Developer, dùng để liên kết Universal Links.",
        "androidPkg": "Tên gói Android",
        "androidPkgHint": "Trùng với applicationId của ứng dụng Android; nhập cùng dấu vân tay chứng chỉ. Không cần cấu hình Apple để dùng chia sẻ Android.",
        "androidSha": "Dấu vân tay SHA-256 chứng chỉ ký Android",
        "androidShaHint": "Mỗi dòng một dấu vân tay gồm 32 nhóm ngăn bởi dấu hai chấm. Google Play dùng chứng chỉ ký ứng dụng, không phải chứng chỉ tải lên; hỗ trợ nhiều dấu vân tay khi xoay vòng. Cần mở công khai /.well-known/assetlinks.json.",
        "androidShaPlaceholder": "AA:BB:… (dấu vân tay SHA-256 đầy đủ)",
        "bundleHint": "Chỉ dùng cho iOS; dùng lại Bundle ID trong «Thanh toán & thông báo → Kết nối máy chủ Apple», Android không cần.",
        "iosNotConfigured": "iOS chưa được cấu hình",
        "footnote": "iOS cần cấu hình Associated Domains, Android cần cấu hình App Links và xác minh trên máy thật bằng chữ ký phát hành. Lưu tên miền không tự thay đổi DNS, reverse proxy hay dự án ứng dụng."
      }
    },
    "payment": {
      "upstreamModules": "Mô-đun thanh toán App & giá media",
      "upstreamModulesDesc": "Apple / Google Play / Android và bảng giá ảnh-video theo điểm; mỗi mục lưu riêng"
    },
    "routing": {
      "refLimits": {
        "error": "Hãy nhập số nguyên 0–100",
        "advanced": "Cài đặt mô hình nâng cao",
        "pending": "{n} giới hạn tham chiếu cần sửa",
        "summary": "Cấu hình số lượng tư liệu tham chiếu theo mô hình",
        "title": "Giới hạn tư liệu tham chiếu",
        "desc": "Giới hạn số ảnh, video và âm thanh tham chiếu trong một lần tạo. Mỗi mục là số nguyên 0–100, 0 nghĩa là không hỗ trợ; khung đầu/cuối và bảng phong cách cũng tính vào số ảnh.",
        "model": "Mô hình",
        "images": "Ảnh / tấm",
        "videos": "Video / đoạn",
        "audios": "Âm thanh / đoạn",
        "unsupported": "Không hỗ trợ",
        "footnote": "Các giá trị này dùng để kiểm tra số lượng trước khi gửi tác vụ. Mô hình tạo ảnh chỉ nhận ảnh tham chiếu; khả năng thực tế tùy mô hình thượng nguồn."
      }
    }
  },
  "layout": {
    "nav": {
      "adjustments": "Điều chỉnh số dư",
      "marketplace": "Vận hành chợ tài sản số"
    },
    "titles": {
      "teamDetail": "Chi tiết nhóm"
    },
    "closeNav": "Đóng điều hướng",
    "openNav": "Mở điều hướng",
    "skipToContent": "Chuyển đến nội dung trang",
    "adminNav": "Điều hướng quản trị",
    "mainNav": "Điều hướng chính",
    "search": {
      "trigger": "Tìm chức năng quản trị",
      "placeholder": "Tìm chức năng…"
    },
    "userSite": "Trang người dùng"
  },
  "tasks": {
    "detail": {
      "notRecorded": "Chưa ghi nhận",
      "tabs": {
        "upstream": "Yêu cầu thượng nguồn",
        "jsonRedacted": "JSON tác vụ (đã che)"
      },
      "alerts": "Bất thường & gợi ý",
      "waitingActivation": "Tác vụ chưa được kích hoạt, đang chờ điều kiện trước hoặc khe đồng thời trống.",
      "payloadHint": "Đây là tham số điều phối nội bộ; yêu cầu thực gửi lên thượng nguồn xem ở tab «Yêu cầu thượng nguồn».",
      "frozen": "Đang tạm giữ",
      "notSettled": "Chưa quyết toán",
      "snapshotMode": "Chế độ tính phí khi nhận: {mode} · tuyến cố định, lỗi không tự chuyển",
      "sitePrice": "Giá nội bộ #{v}",
      "legacyRules": "Quy tắc tính phí cũ",
      "nSeconds": "{n} giây",
      "nImages": "{n} ảnh",
      "usageHint": "Bản ghi sử dụng là căn cứ tính phí; số tiền ví thực trừ và hoàn lấy theo tóm tắt quyết toán của tác vụ.",
      "delivered": "Đã giao",
      "notDelivered": "Chưa giao"
    },
    "descApiOnly": "Nền tảng tác vụ hợp nhất · tự làm mới {sec}s · nút này chỉ chạy API, hàng đợi do nút thực thi xử lý",
    "runtime": {
      "noRecord": "Chưa có bản ghi",
      "secs": "{s} giây",
      "minsSecs": "{m} phút {s} giây",
      "hoursMins": "{h} giờ {m} phút",
      "ago": "{time} trước",
      "apiOnlyNode": "Nút này chỉ chạy API",
      "unknown": "Runtime: chưa rõ trạng thái",
      "healthy": "Runtime: bình thường",
      "unhealthy": "Runtime: bất thường",
      "apiOnlyDesc": "Nút này chỉ chạy API / hàng đợi do nút thực thi xử lý",
      "loops": "Scheduler {scheduler} · poller {poller} · watchdog {watchdog}",
      "lastSuccess": "Lần điều phối thành công gần nhất: {ago}",
      "consecutiveFailures": "Lỗi liên tiếp: {n}",
      "oldestWait": "Tác vụ đến hạn chờ lâu nhất: {time}",
      "legend": "«Chờ kích hoạt» nghĩa là điều kiện trước hoặc khe đồng thời chưa sẵn sàng; «trì hoãn» nghĩa là chưa đến giờ điều phối."
    },
    "stats": {
      "pendingBreakdown": "Chờ điều phối {ready} · chờ kích hoạt {deferred} · trì hoãn {delayed}",
      "activeBreakdown": "Đang chạy {running} · thăm dò {poll} · đang hủy {cancelling}",
      "nodeSlots": "Khe thực thi của nút này",
      "apiOnly": "Chỉ API",
      "handledByWorkers": "Hàng đợi do nút thực thi xử lý"
    },
    "queues": {
      "title": "Hàng đợi điều phối",
      "name": "Hàng đợi {label}",
      "counts": "Đang chờ {pending} · đang xử lý {active} · đồng thời {max}",
      "awaitingPoll": "Chờ thượng nguồn {n}"
    },
    "cols": {
      "taskModel": "Tác vụ / mô hình",
      "upstream": "Thượng nguồn",
      "billing": "Tính phí",
      "elapsed": "Thời gian chạy",
      "userRef": "Người dùng / liên kết"
    },
    "obs": {
      "phase": {
        "started": "Bắt đầu gửi yêu cầu",
        "accepted": "Upstream đã phản hồi",
        "failed": "Yêu cầu thất bại",
        "poll": "Truy vấn kết quả",
        "simulated": "Giả lập cục bộ · đã ghi tham số"
      },
      "state": {
        "queued": "Upstream đang xếp hàng",
        "running": "Upstream đang tạo",
        "succeeded": "Upstream hoàn tất",
        "failed": "Upstream thất bại",
        "cancelled": "Upstream đã hủy",
        "other": "Trạng thái upstream: {status}"
      },
      "providerOnly": "Đã có tác vụ upstream · chưa ghi HTTP",
      "noUpstream": "Chưa có yêu cầu upstream nào",
      "billing": {
        "none": "Chưa tạm giữ · chưa quyết toán",
        "frozen": "Đã tạm giữ · chưa quyết toán",
        "settled": "Đã quyết toán",
        "skipped": "Bỏ qua tạm giữ · chưa quyết toán",
        "unknown": "Chưa ghi trạng thái tính phí"
      },
      "queueType": {
        "text": "Văn bản",
        "image": "Hình ảnh",
        "video": "Video"
      },
      "lane": {
        "text": "Âm thanh & khác",
        "image": "Hình ảnh",
        "video": "Video"
      },
      "queueBadge": "Hàng đợi {type}",
      "direct": "Chạy trực tiếp",
      "directDesc": "Gọi LLM trực tiếp · không qua hàng đợi",
      "providerSuffix": " · upstream {status}",
      "stepNotRecorded": "Chưa ghi bước",
      "modelNotRecorded": "Chưa ghi model",
      "actualModel": "Model thực tế đã gọi",
      "actualModelShort": "Model thực tế",
      "simulatedModel": "Model giả lập",
      "selectedModel": "Model do tác vụ chọn",
      "frozenAmount": "Tạm giữ {amount}",
      "notCharged": "Chưa trừ phí",
      "estimate": "Ước tính {amount}",
      "refundShort": " · hoàn {amount}",
      "refund": " · đã hoàn {amount}",
      "unsettledSuffix": " · chưa quyết toán",
      "timing": "Đang đếm giờ",
      "waitRun": "Chờ {wait} · chạy {run}",
      "notStarted": "Chưa bắt đầu",
      "created": "Tạo {time}",
      "detail": "Chi tiết",
      "cancel": "Hủy tác vụ",
      "episodeRef": "Tập #{id}",
      "fragmentRef": "Phân cảnh #{id}",
      "pendingGeneric": "Chờ xử lý",
      "waitingActivation": "Chờ kích hoạt",
      "delayed": "Đang trì hoãn",
      "ready": "Chờ điều phối",
      "copied": "Đã sao chép",
      "copyFailed": "Sao chép thất bại, hãy chọn thủ công",
      "copy": "Sao chép",
      "status": "Trạng thái",
      "upstream": "Upstream",
      "viewRequests": "Xem yêu cầu",
      "providerTaskMissing": "Chưa ghi ID tác vụ upstream",
      "elapsed": "Thời gian",
      "billingLabel": "Tính phí · {state}",
      "settled": "Đã quyết toán",
      "unsettled": "Chưa quyết toán",
      "breakdown": "Chi tiết",
      "notRecorded": "Chưa ghi"
    },
    "upstreamPanel": {
      "redacted": "Đã ẩn dữ liệu nhạy cảm",
      "notOnPage": "Không có trong trang này, hãy chuyển trang để xem lịch sử",
      "latestPhase": "Giai đoạn gần nhất",
      "pageCount": "Trang này {page} mục · lịch sử {total} mục",
      "refresh": "Làm mới bản ghi upstream",
      "hint": "Phân trang theo ID sự kiện, mới nhất trước; trong mỗi trang, gửi và phản hồi được nối theo ID yêu cầu. Một yêu cầu có thể nằm ở nhiều trang, sự kiện truy vấn có thể chỉ là mẫu.",
      "retry": "Thử lại",
      "loading": "Đang tải sự kiện upstream của trang này…",
      "empty": "Trang này không ghi yêu cầu HTTP upstream hay tham số giả lập nào. Có ID tác vụ upstream hoặc tác vụ đã xong cũng không thể dựng lại nội dung yêu cầu thực tế.",
      "localMock": "Giả lập cục bộ",
      "mediaGeneration": "Tạo media",
      "endpointMissing": "Chưa ghi endpoint",
      "noHttp": "Không gửi HTTP",
      "model": "Model",
      "providerTask": "Tác vụ upstream",
      "requestId": "ID yêu cầu",
      "eventRef": "Sự kiện #{id}",
      "simulatedFinal": "Dưới đây là URL, header và JSON body thực tế đã chuẩn bị sau khi định tuyến kênh, ánh xạ model và chuyển đổi giao thức (đã ẩn thông tin xác thực). Yêu cầu bị chặn trước khi gửi HTTP và dùng media mặc định.",
      "simulatedLegacy": "Bản ghi cũ chỉ lưu tham số nghiệp vụ đầu vào, không phải HTTP body cuối cùng; các tác vụ giả lập tạo sau này sẽ ghi tham số yêu cầu cuối.",
      "mockParams": "Tham số yêu cầu giả lập",
      "request": "Yêu cầu",
      "response": "Phản hồi",
      "error": "Lỗi",
      "stepData": "Dữ liệu các bước (bản ghi thực thi nội bộ)",
      "stepDataHint": "Đây là đầu vào và kết quả của các bước, không phải HTTP body thực sự gửi lên upstream.",
      "stepInput": "Đầu vào bước",
      "stepOutput": "Kết quả bước"
    }
  },
  "templates": {
    "editor": {
      "errors": {
        "id": "Hãy nhập ID mẫu dài 1–64 ký tự",
        "name": "Hãy nhập tên mẫu dài 1–128 ký tự",
        "shot_duration_min": "Thời lượng ngắn nhất phải là số giây nguyên lớn hơn 0",
        "shot_duration_max": "Thời lượng dài nhất phải là số giây nguyên lớn hơn 0",
        "maxLtMin": "Thời lượng dài nhất không được nhỏ hơn ngắn nhất",
        "sort_order": "Giá trị sắp xếp phải là số nguyên"
      },
      "untitled": "Mẫu chưa đặt tên",
      "perShot": "{min}–{max} giây / cảnh",
      "willPublish": "Hiển thị sau khi lưu",
      "willUnpublish": "Lưu ở trạng thái ẩn",
      "fixBasics": "Hãy hoàn thiện thông tin cơ bản: {list}.",
      "errorSep": "; ",
      "sectionDisplay": "Thông tin hiển thị",
      "sectionDefaults": "Mặc định khi tạo",
      "idHint": "Định danh duy nhất của mẫu, không đổi được sau khi tạo.",
      "nameHint": "Hiển thị trong danh sách chọn mẫu của người dùng.",
      "descHint": "Mô tả ngắn đề tài và hiệu ứng hình ảnh phù hợp.",
      "categoriesHint": "Nhiều nhãn ngăn cách bằng dấu phẩy.",
      "sortHint": "Số càng nhỏ càng đứng trước, có thể dùng số âm.",
      "shotMaxHint": "Không được nhỏ hơn thời lượng ngắn nhất.",
      "stylePromptHint": "Mô tả phong cách, ánh sáng và màu sắc, dùng làm phong cách nền khi tạo.",
      "characterPromptHint": "Yêu cầu ngoại hình và trang phục cho ảnh nhân vật.",
      "extraPromptHint": "Bổ sung yêu cầu chung khi tạo ảnh.",
      "llmSystemHint": "Hướng dẫn thêm cho mô hình văn bản khi viết kịch bản và lập kế hoạch.",
      "negativePromptHint": "Liệt kê nội dung hoặc hiệu ứng muốn tránh."
    }
  },
  "users": {
    "role": {
      "user": "Người dùng thường",
      "admin": "Quản trị viên"
    },
    "edit": {
      "adjustedSaved": "Đã điều chỉnh số dư và lưu",
      "saveFailedRetry": "Lưu thất bại, hãy thử lại",
      "saveAdjust": "Xác nhận điều chỉnh và lưu",
      "saveRole": "Lưu thay đổi quyền",
      "currentBalance": "Số dư hiện tại",
      "frozen": "Đang tạm giữ",
      "frozenHint": "Điều chỉnh không thay đổi số tiền tác vụ đang tạm giữ",
      "permissions": "Quyền tài khoản",
      "roleHint": "Quản trị viên có thể vào trang quản trị, xem và quản lý toàn bộ dữ liệu.",
      "adjustTitle": "Điều chỉnh số dư tài khoản",
      "adjustDesc": "Bật khi cần; nếu chỉ đổi vai trò, số dư giữ nguyên.",
      "direction": "Hướng điều chỉnh",
      "increase": "Cộng thêm",
      "decrease": "Trừ bớt",
      "amount": "Số tiền điều chỉnh",
      "amountHint": "Số tiền lớn hơn 0, tối đa 2 chữ số thập phân.",
      "noteHint": "Ghi chú được lưu vào lịch sử ví để đối soát sau này.",
      "notePlaceholder": "Ví dụ: bù thưởng sự kiện, thu hồi hoàn tiền",
      "afterSave": "Số dư sau khi lưu",
      "errEmpty": "Hãy nhập số tiền cần điều chỉnh",
      "errInvalid": "Hãy nhập số tiền hợp lệ (tối đa 2 chữ số thập phân)",
      "errZero": "Số tiền điều chỉnh phải lớn hơn 0",
      "errTooLarge": "Số dư sau điều chỉnh quá lớn, hãy giảm số tiền",
      "errNegative": "Số tiền trừ không được vượt quá số dư hiện tại"
    }
  },
  "orders": {
    "usage": {
      "modelPlaceholder": "Mô hình (vd: seedance-2.5)"
    }
  },
  "finance": {
    "adjustRecords": {
      "credit": "Cộng",
      "debit": "Trừ",
      "loadFailed": "Tải bản ghi điều chỉnh thất bại",
      "title": "Điều chỉnh số dư thủ công",
      "desc": "Các bút toán phát sinh khi sửa số dư thủ công trong quản lý người dùng, kèm người thao tác và ghi chú",
      "allDirections": "Mọi chiều",
      "filter": "Lọc",
      "listTitle": "Bản ghi điều chỉnh thủ công",
      "total": "Tổng {n} mục",
      "colTime": "Thời gian",
      "colUser": "Người dùng",
      "colDirection": "Chiều",
      "colDelta": "Biến động",
      "colBalance": "Số dư sau",
      "colOperator": "Người thao tác",
      "colNote": "Ghi chú",
      "loading": "Đang tải…",
      "empty": "Chưa có bản ghi điều chỉnh thủ công"
    }
  },
  "marketplace": {
    "availability": {
      "loading": "Đang đọc trạng thái dịch vụ chợ tài sản số…",
      "error": "Tạm thời không lấy được trạng thái dịch vụ chợ tài sản số, vui lòng thử lại.",
      "reload": "Tải lại",
      "disabled": "Chợ tài sản số chưa được bật. Hãy bật tính năng này rồi thử lại.",
      "refresh": "Làm mới trạng thái dịch vụ"
    }
  }
}
