BaByLon V1
===========

BaByLon là tiện ích Chrome đa chức năng.

Chức năng 1: Keywords YouTube
- Từ khóa cấp kênh
- Thẻ video mới nhất
- Thẻ video tổng hợp
- Hashtag

Chức năng 2: Cuộn xuống
- Tự động cuộn trang hiện tại
- Chờ nội dung tải thêm
- Tiếp tục cuộn cho tới cuối
- Bấm lần nữa để dừng

CÀI ĐẶT
1. Giải nén thư mục BaByLon.
2. Mở chrome://extensions
3. Bật Chế độ dành cho nhà phát triển.
4. Bấm "Tải tiện ích đã giải nén".
5. Chọn thư mục babylon-extension.

Lưu ý: Chrome không cho tiện ích chạy script trên các trang hệ thống như chrome://extensions.


V8: Khi chọn Cuộn xuống, popup tự thu gọn còn khoảng 332px để không che video. Khi mở lại popup, nút tự đồng bộ trạng thái đang cuộn/dừng.


V8: Chế độ Cuộn xuống siêu gọn. Chỉ giữ header + thanh chức năng ở góc trên; nút Cuộn xuống vừa bắt đầu vừa dừng tự cuộn.


V8:
- Thêm chức năng số 3: Check Giờ đăng.
- Tự đọc URL video của tab hiện tại khi mở chức năng Giờ đăng.
- Nếu nhận đúng link video, tự điền và tự kiểm tra.
- Hỗ trợ YouTube (watch / Shorts / Live / youtu.be), Facebook và TikTok.
- Có nút Trang hiện tại để đọc lại URL bất kỳ lúc nào.
- YouTube API key là tùy chọn, không bắt buộc.


V8 - tích hợp thêm 4 tiện ích Facebook:
4. Tích bạn bè vô Group.
5. Mời người đã thích bài viết.
6. Tự động đăng bài Group.
7. Tự động duyệt bài Group.

Ghi chú:
- Các công cụ Facebook giữ logic từ 4 tiện ích nguồn người dùng cung cấp.
- Công cụ Đăng Group cần quyền notifications, unlimitedStorage và debugger.
- Công cụ Duyệt bài có thể dùng OpenAI API key theo đúng tiện ích gốc.
- BaByLon vẫn giữ chế độ Cuộn xuống siêu gọn; 4 tab Facebook sẽ ẩn khi đang ở chế độ cuộn.


V8:
8. Tải video (best-effort, không vượt DRM):
- Tự đọc link video đang xem hiện tại.
- Có thể dán link Facebook, TikTok, Douyin, Bilibili, YouTube.
- Quét nguồn <video>, OpenGraph, JSON-LD, media resource và dữ liệu player công khai.
- YouTube chỉ dùng direct/progressive URL mà trang công khai; không giải signatureCipher.
- Bilibili ưu tiên durl; DASH video-only được ghi rõ.
- Nút TẢI dùng Chrome Downloads và luôn hỏi nơi lưu.
- Chỉ dùng với nội dung bạn sở hữu hoặc được phép tải/sử dụng.


V8 - Downloader nâng cấp:
- Có ô đặt tên file trực tiếp.
- Tải thẳng vào Downloads, không tạo thư mục BaByLon.
- Hiển thị lựa chọn chất lượng (144p/240p/360p/480p/720p/1080p/2K/4K nếu trang công khai các luồng đó).
- Chỉ coi nguồn muxed là video phát được trực tiếp; video-only được ghi rõ cần ghép audio.
- Kiểm tra nguồn bằng Range request trước khi tải để chặn phản hồi vài byte/HTML giả video.
- Hiển thị đúng phần mở rộng theo MIME: MP4 / WEBM / M4A / MP3.
- Audio gốc có thể tải trực tiếp.
- MP3 128 kbps thật và ghép Full HD trở lên dùng Media Helper đi kèm (Python + FFmpeg).


V8 - sửa downloader:
- Sửa lỗi "Failed to fetch": không còn fetch Range/HEAD URL Googlevideo trước khi tải.
- Tải file trực tiếp bằng chrome.downloads từ background service worker.
- Theo dõi MIME/kích thước sau khi Chrome bắt đầu download; tự xóa file HTML/JSON hoặc file lỗi dưới 1 KB.
- YouTube không còn đưa meta "Video công khai" vào danh sách tải.
- Shorts dọc 360x640 hiển thị đúng 360p thay vì 640p.
- Ưu tiên các direct/muxed format mà YouTube player thực sự công khai.
- 1080p+ video-only và MP3 vẫn dùng Media Helper để ghép/chuyển mã khi cần.


Downloader mới:
- Giữ tên extension là BaByLon.
- Tham khảo kiến trúc của downloader chuyên dụng: phát hiện/resolve định dạng riêng, xử lý HLS/DASH bằng engine thay vì tải URL tạm trong DOM.
- Media Engine dùng yt-dlp để lấy format list và tải theo format ID.
- FFmpeg dùng cho ghép video+audio và MP3.
- File lưu thẳng vào Downloads với tên người dùng nhập.


Downloader Media Capture:
- Không bắt buộc Media Engine để phát hiện/tải các file media trực tiếp.
- Khi mở Tải video, BaByLon gắn Chrome Debugger Network vào tab hiện tại.
- Video phải phát vài giây để trình phát request các stream.
- YouTube nhận diện itag và hiện đúng 360p/720p/1080p... khi stream đó xuất hiện.
- Stream video-only được ghi rõ "không tiếng"; audio hiện riêng.
- Cách này gần với mô hình Media Panel: tự phát hiện media khi trang thực sự tải/phát.
- Không vượt DRM/luồng bị khóa.


Phân loại nền tảng trên giao diện:
- Keywords: YouTube.
- Cuộn xuống: tất cả website.
- Giờ đăng: YouTube, Facebook, TikTok.
- Tải video: YouTube, Facebook, TikTok, Douyin, Bilibili.
- Tích mời / Mời người thích / Đăng Group / Duyệt bài: Facebook.
- Popup tự nhận diện trang hiện tại; công cụ phù hợp được viền sáng, công cụ không phù hợp được làm mờ nhẹ nhưng vẫn có thể bấm.


Sửa bộ quét Keywords:
- Lỗi cũ: background tab nhảy thẳng xuống cuối khiến YouTube Shorts chỉ lazy-load khoảng 10–20 nội dung.
- Cách mới: ưu tiên ytInitialData + YouTube continuation để lấy toàn bộ Video/Shorts/Live.
- Nếu continuation thay đổi, fallback cuộn từng viewport nhỏ và chờ lazy-load.
- Giảm concurrency đọc watch page xuống 4 để hạn chế YouTube throttle.


Keywords nâng cấp:
- Hashtag được tách thành 2 nhóm:
  1) tối đa 15 Video/Shorts/Live mới đăng gần nhất;
  2) tối đa 15 Video/Shorts/Live đầu tiên/cũ nhất của kênh.
- Bộ quét chạy trong background service worker.
- Có thể đóng popup hoặc chuyển sang tab/cửa sổ Chrome khác, job vẫn tiếp tục.
- Kết quả được lưu trong chrome.storage.local.
- Mở lại BaByLon sẽ hiển thị đúng kết quả/tìm kiếm trước đó.
- Chỉ khi chủ động bấm quét kênh mới thì kết quả cũ mới được thay thế.


Duyệt bài - Scan nâng cấp:
- Không còn dừng sau 1 lần scrollHeight không đổi.
- Đọc tổng số bài chờ duyệt trên trang (ví dụ 15) và cố quét đủ 15/15.
- Cuộn từng viewport, chờ lazy-load và retry/nudge khi Facebook tải chậm.
- Tích lũy bài trong lúc cuộn để không mất bài khi Facebook virtualize DOM.
- Popup hiển thị tiến độ quét x/y theo thời gian thực.


Sửa độ chính xác 15 nội dung đầu tiên:
- Lỗi trước: suy ra “cũ nhất” bằng các ID cuối trong continuation. Thứ tự continuation/renderers nội bộ của YouTube không được đảm bảo nên có thể chọn sai.
- Cách mới: mở từng tab Video/Shorts/Live, lấy Mới nhất, sau đó bấm chính chip “Cũ nhất / Oldest” của YouTube và lấy card đầu tiên.
- Cuối cùng đọc publishDate để trộn ba loại nội dung và chọn đúng 15 nội dung có ngày đăng sớm nhất toàn kênh.


Keywords Speed Mode:
- Video / Shorts / Live được mở và xử lý song song.
- Không crawl toàn bộ continuation chỉ để lấy tổng số video.
- Mỗi tab lấy 18 ứng viên Mới nhất + 18 ứng viên Cũ nhất (đủ buffer để chọn 15 toàn kênh).
- Metadata tăng concurrency từ 4 lên 8.
- Cache metadata video 7 ngày; quét lại cùng kênh nhanh hơn rõ rệt.
- Rút ngắn thời gian chờ UI Cũ nhất/Oldest nhưng vẫn kiểm tra card đã đổi trước khi lấy dữ liệu.


Reset Keywords khi Reload trang:
- Đóng popup hoặc chuyển tab/cửa sổ Chrome: kết quả và tiến độ vẫn được giữ.
- F5 / Ctrl+R / Reload trên trang YouTube đang active: xóa kết quả Keywords + link kênh đã lưu.
- Nếu đang quét khi Reload: job cũ bị yêu cầu dừng và không được ghi kết quả trở lại.
- Sau Reload, mở BaByLon sẽ là ô Keywords trống để nhập/quét kênh YouTube khác.


Keywords mẫu 12:
- Hashtag mới nhất: mục tiêu đúng 12 nội dung.
- Hashtag đầu tiên: mục tiêu đúng 12 nội dung.
- Collector lấy dư 30 card mỗi tab và chờ lazy-load lâu hơn để tránh chỉ lấy được 1 hàng = 6 video.
- Vẫn xử lý Video / Shorts / Live song song và metadata 8 luồng để giữ tốc độ.


Sửa hashtag bị 0 dù video có hashtag:
- Nguyên nhân: service-worker fetch trang watch đôi khi nhận HTML rút gọn, shortDescription rỗng; cache V2 còn giữ kết quả rỗng.
- Bản mới dùng youtubei/player ngay trong context tab YouTube để đọc videoDetails.shortDescription/keywords và microformat.publishDate.
- Cache đổi sang V3 để bỏ toàn bộ cache rỗng của bản cũ.
- Bộ lấy card Shorts hỗ trợ renderer mới và cuộn tới card cuối để nạp đủ mục tiêu 12.


Keywords Speed Boost:
- Chỉ lấy đúng tối đa 12 ứng viên mới nhất + 12 cũ nhất trên mỗi tab, thay vì 18/30.
- Lazy-load card bị giới hạn 10 vòng ngắn; không còn chờ hàng chục giây nếu YouTube đứng.
- Poll chuyển Cũ nhất dùng ID đầu nhẹ, không gọi quét DOM lồng nhau.
- Player metadata tăng tối đa 16 request song song.
- HTML fallback chỉ chạy cho ID bị thiếu và chạy 8 request song song.
- Đọc từ khóa cấp kênh giảm số lần retry.


Sửa định nghĩa 12 video đầu tiên:
- Không còn hiểu là 12 nội dung cũ bất kỳ từ từng tab.
- Lấy channelId -> playlist Uploads (UU...) của toàn kênh.
- Playlist Uploads được duyệt đến hết; 12 phần tử cuối = 12 upload công khai đầu tiên kênh từng đăng.
- Bao gồm Shorts/Video/Live nếu chúng là upload công khai trong lịch sử kênh.
- Cache metadata đổi V4 để loại bỏ kết quả mô tả/hashtag rỗng của bản cũ.


Hashtag definitive fix:
- Không còn phụ thuộc duy nhất vào videoDetails.shortDescription.
- Mỗi video dùng youtubei/player + youtubei/next; /next đọc structured description hiện tại.
- Nếu API vẫn không trả hashtag, BaByLon mở chính watch page ẩn và đọc DOM mô tả mà người dùng nhìn thấy.
- Hashtag được lưu riêng trong metadata và gộp trực tiếp, không chỉ regex lại description.
- Cache rỗng cũ bị bỏ; tuyệt đối không cache kết quả rỗng thiếu hashtag/description.


Check IP & YouTube:
- Lấy IP công khai hiện tại.
- Kiểm tra một nhóm DNS blacklist phổ biến qua DNS-over-HTTPS.
- Kiểm tra tín hiệu truy cập YouTube: HTTP 204/200, 429, 403, và dấu hiệu "unusual traffic".
- Không gọi kết quả này là "YouTube blacklist chính thức" vì YouTube không cung cấp danh sách blacklist IP công khai.
- Kết quả dùng để phân biệt: IP reputation xấu vs. dấu hiệu YouTube/Google đang rate-limit hoặc từ chối mạng.


Check IP nâng cấp:
- Có ô nhập IPv4 bất kỳ để kiểm tra DNS blacklist/reputation.
- Có nút CHECK IP HIỆN TẠI để lấy IP công khai và kiểm tra thêm tín hiệu YouTube/Google 204/429/403/unusual traffic.
- Có nút LẤY IP HIỆN TẠI để điền IP vào ô nhập.
- IP nhập tay không thể kiểm tra tín hiệu YouTube trực tiếp vì request YouTube vẫn xuất phát từ IP hiện tại của máy.


Dock giao diện:
- Nút ▣ trên header BaByLon mở menu: Bên trái / Bên phải / Phía dưới.
- Khi chọn, BaByLon được ghim ngay trong trang web đang mở.
- Thanh trên panel có nút ◀ / ▶ / ▼ để đổi vị trí tức thì và ✕ để đóng.
- Panel cạnh trái/phải có thể kéo mép để thay đổi độ rộng.
- Panel phía dưới có thể kéo mép trên để thay đổi chiều cao.
- Vị trí/kích thước cuối được lưu.
- Không gắn được vào các trang nội bộ chrome:// vì Chrome chặn extension injection trên trang hệ thống.


BaByLon 1.13:
- Dock phía dưới tăng chiều cao mặc định và tăng cỡ chữ/nút để dễ nhìn.
- Thanh Dock cao hơn, nút trái/phải/dưới lớn hơn.
- Khi bấm Cuộn xuống, toàn bộ các chức năng khác vẫn hiển thị.
- Không còn ẩn Keywords/Tải video/Facebook tools khi tự cuộn.
- Nếu đang tự cuộn và bấm sang bất kỳ chức năng khác, BaByLon tự gửi lệnh dừng cuộn trước rồi mới mở chức năng đó.


BaByLon 1.14 - Responsive Dock:
- Khi ghim trái/phải/dưới, website được dành lại phần màn hình còn trống thay vì bị panel đè lên.
- Kéo thay đổi kích thước panel -> website reflow theo thời gian thực.
- Có nút ↔ trên thanh Dock để bật/tắt chế độ Responsive.
- YouTube có rule riêng cho ytd-app / masthead / page-manager để grid video co lại rõ hơn.
- Facebook/TikTok và SPA phổ biến có fallback root sizing.
- Khi đóng Dock, toàn bộ phần reserve được gỡ và website trở lại kích thước ban đầu.
- Đây là responsive ở cấp trang web. Chrome không cho content script thay đổi window.innerWidth thật của tab như native Side Panel.


BaByLon 1.15 - sửa Dock bị giật/loạn:
- Loại bỏ vòng lặp resize gây giật: không còn tự phát window.resize sau mỗi lần responsive.
- Iframe BaByLon chỉ load 1 lần; chuyển Trái/Phải/Dưới không reload lại popup nên không nhảy link/trạng thái.
- Host Dock chỉ chiếm đúng vùng panel, không phủ invisible lên toàn màn hình.
- Vì vậy Dock phía dưới không còn chặn click/scroll ở vùng website phía trên.
- Responsive bên trái chỉ dịch website đúng 1 lần; bỏ margin kép ở ytd-app/page-manager.
- Responsive bên phải co website ổn định theo chiều rộng còn lại.
- Dock dưới không ép chiều cao body/ytd-app; chỉ chừa khoảng scroll phía dưới để tránh làm hỏng thao tác.
- Resize panel được throttle bằng requestAnimationFrame để kéo mượt hơn.


BaByLon 1.16 - Native Chrome Side Panel:
- Bỏ cách responsive giả bằng cách ép body/ytd-app.
- Nút ▤ mở Chrome Side Panel thật, giống kiểu Video DownloadHelper.
- Chrome tự chia khung trình duyệt: website co/reflow thật theo phần màn hình còn lại.
- Kéo mép Side Panel của Chrome -> YouTube/Facebook/TikTok tự responsive theo viewport thật.
- Không còn overlay che video, không margin kép, không vòng lặp resize.
- Vị trí trái/phải của Side Panel là cài đặt của Chrome; extension không được phép tự ép vị trí đó.
- Chrome Side Panel không hỗ trợ dock thật ở cạnh dưới. Vì vậy BaByLon không giả lập bottom split nữa để tránh lỗi click/giật.


BaByLon 1.17:
- Thêm nút "CUỘN LÊN ĐẦU TRANG" bên trong chức năng Cuộn xuống.
- Không tạo tab/chức năng mới ở thanh công cụ bên ngoài.
- Nếu đang tự cuộn xuống mà bấm Cuộn lên đầu trang, BaByLon tự dừng tự cuộn trước.
- Tự nhận vùng cuộn chính và cuộn cả root + vùng scroll chính về đầu để hỗ trợ YouTube/Facebook/TikTok và SPA.


BaByLon 1.17.1:
- Đổi icon chức năng Cuộn từ mũi tên xuống thành ↕️.
- Đổi tên tab thành "Cuộn Xuống Cuộn Lên".
- Đổi tiêu đề bên trong thành "Cuộn Xuống / Cuộn Lên".


BaByLon 1.18:
- Đổi tên chức năng thành "Check IP độc".
- Thêm khung Thông tin IP.
- Hiển thị: quốc gia, tỉnh/bang, thành phố, mã quốc gia, ISP/nhà mạng, tổ chức, ASN, múi giờ, tọa độ gần đúng, loại IP.
- Áp dụng cho cả IP hiện tại và IP nhập tay.
- Dữ liệu vị trí IP chỉ là ước lượng theo cơ sở dữ liệu IP, không phải vị trí GPS/địa chỉ chính xác.


BaByLon 1.19:
- Thêm chức năng "Check giờ".
- Chọn quốc gia/khu vực và thành phố để xem giờ hiện tại.
- Đồng hồ hiển thị đủ giờ : phút : giây và cập nhật trực tiếp.
- Hiển thị ngày, quốc gia, khu vực, múi giờ IANA và UTC offset.
- Có nút Giờ máy hiện tại và các thành phố truy cập nhanh.
- Không cần API ngoài; dùng Intl.DateTimeFormat của Chrome.


BaByLon 1.20:
- Card chức năng có viền màu theo nền tảng.
- YouTube = đỏ.
- Facebook = xanh dương.
- TikTok = đen.
- ALL = xanh lá.
- Douyin = xám.
- Bilibili = hồng.
- Card nhiều nền tảng tự tạo gradient kết hợp theo data-platforms.
- Card active dùng nền sáng theo màu nền tảng, viền vẫn rõ và badge giữ đúng màu.
- Check IP Độc đổi data-platforms thành ALL + YouTube để viền kết hợp xanh lá + đỏ.


BaByLon 1.21:
- Check IP Độc mở rộng từ ALL + YouTube thành ALL + YouTube + Facebook + TikTok.
- IP hiện tại được kiểm tra riêng tín hiệu truy cập của 3 nền tảng.
- YouTube: 204 / 429 / 403 / unusual traffic.
- Facebook: HTTP / 429 / 403 / checkpoint-challenge / temporary block.
- TikTok: HTTP / 429 / 403 / captcha-challenge / access denied.
- Nếu từ 2 nền tảng trở lên cùng báo giới hạn, đánh giá tổng thể thành "Rủi ro đa nền tảng".
- DNS blacklist chỉ phản ánh reputation chung; không đồng nghĩa mọi nền tảng đều blacklist IP.
- IP nhập tay vẫn chỉ kiểm tra được reputation/DNSBL; kiểm tra nền tảng chỉ chính xác với IP hiện tại của máy.


BaByLon 1.22:
- Đưa A−, A+ và nút sáng/tối lên ngay header, cạnh nút Side Panel để không chiếm diện tích.
- Bỏ thanh cài đặt giao diện lớn bên dưới header.
- Nút sáng/tối dùng icon mặt trời/mặt trăng dạng vector, xoay chuyển động khi đổi chế độ.
- Cỡ chữ vẫn được lưu bằng chrome.storage.local.
- Dark mode được làm lại với nền navy/đen, card tối nhiều lớp, input tối, scrollbar tối và giữ viền màu nền tảng.


BaByLon 1.22.1 HOTFIX:
- Khôi phục đầy đủ popup.js 1.21 (Keywords, Giờ đăng, Check giờ, Tải video, Facebook tools, Check IP Độc).
- Giữ A− / A+ / nút sáng-tối ở header từ 1.22.
- Sửa lỗi nghiêm trọng: 1.22 thiếu stopBaByLonScrollIfRunning và mất phần lớn logic tính năng, khiến mọi tab ngoài Cuộn xuống/Cuộn lên không mở được.
- openToolPage có guard để một lỗi auto-scroll phụ không thể khóa toàn bộ menu lần nữa.


BaByLon 1.22.2 - Comfort Dark Theme:
- Dark mode dịu mắt, không dùng đen tuyệt đối.
- Mỗi module có màu nhấn riêng nhưng cùng một hệ nền navy.
- Keywords, Cuộn, Giờ đăng, Check giờ, Tải video, Check IP đều có dark styling riêng.
- Các module Facebook nhúng trong iframe được đồng bộ theme và cỡ chữ theo BaByLon.
- Warning/success/error được chuyển sang màu tối dịu, tránh card trắng chói.
- Chỉ sửa giao diện/CSS theme, không thay đổi logic chức năng chính.


BaByLon 1.22.3 - Dark Harmony:
- Loại bỏ các mảng trắng còn sót ở header module Facebook và Check IP.
- Header chuyển sang navy/slate dịu mắt, viền xanh trầm.
- Iframe Facebook được ép nền tối cả html/body để vùng trống không trắng.
- Duyệt bài, Mời người thích, Đăng Group, Tích mời đồng bộ dark mode.
- Không thay đổi logic chức năng.


BaByLon 1.23 Downloader:
- Tích hợp Media Engine cục bộ yt-dlp + FFmpeg.
- Phân tích nhiều chất lượng video thay vì chỉ luồng đang phát.
- Tự ghép video-only + audio thành MP4 hoàn chỉnh.
- MP3 320K/192K/128K.
- Hỗ trợ link YouTube/Facebook/TikTok/Douyin/Bilibili.
- Lưu thẳng Downloads theo tên người dùng nhập.
- Network Capture chỉ còn là fallback khi Engine không chạy.
- Không vượt DRM/nội dung bị khóa.


BaByLon 1.24 Downloader Fix
- Media Engine installer được viết lại: cài vào %LOCALAPPDATA%\BaByLonMediaEngine.
- Tự tải yt-dlp, FFmpeg/FFprobe; Deno là tùy chọn.
- Có nguồn tải dự phòng và curl/Invoke-WebRequest fallback.
- Engine tự chạy nền và tự khởi động cùng Windows.
- Có START_ENGINE.bat / STOP_ENGINE.bat / REPAIR_ENGINE.bat.
- BaByLon tự dò Engine mỗi 2 giây sau khi tải bộ cài; khi Engine sẵn sàng sẽ tự phân tích lại.
- yt-dlp tự thử cập nhật khi extractor lỗi rồi phân tích lại một lần.
- 1080p+/adaptive stream được ghép video + audio bằng FFmpeg.
- MP3 320/192/128 kbps.
- Chuẩn hóa H.264 + AAC khi codec gốc dễ lỗi Windows.


BaByLon 1.25 Direct Downloader:
- Loại bỏ hoàn toàn Media Engine/localhost/.bat khỏi chức năng tải.
- Dán link hoặc dùng Trang hiện tại -> BaByLon tự mở tab nền khi cần, đọc metadata và bắt Network.
- Liệt kê video/audio trực tiếp mà trang thực sự cung cấp.
- Ưu tiên luồng có sẵn hình + tiếng; video-only được ghi rõ, không giả thành MP4 có tiếng.
- Audio tải đúng định dạng nguồn (M4A/WebM/MP3 nếu nguồn thực sự là MP3).
- Với YouTube, chất lượng cao thường tách video/audio; bản Direct không tự ghép/transcode vì Chrome không có bộ mux/MP3 encoder tích hợp.
- Không hỗ trợ DRM hoặc nội dung bị khóa.


BaByLon 1.26 Direct Quality Fix:
- YouTube: lần lượt gọi các quality level của player để Network capture thấy nhiều itag hơn.
- Loại bỏ range/rn/rbuf/sq/ump/alr/srfvp khỏi URL googlevideo trước khi tải để tránh lưu chunk hỏng.
- Chỉ hiển thị stream YouTube có itag/metadata xác định; không coi URL SABR/range mơ hồ là MP4 hoàn chỉnh.
- Preflight URL trước khi tải.
- Audio hiển thị đúng M4A/WebM/MP3 gốc; không đổi đuôi giả thành MP3.


BaByLon 1.27.0 — Cốc Cốc style downloader (independent implementation):
- Giao diện danh sách VIDEO / AUDIO / PHỤ ĐỀ giống cách chọn tệp tải của trình duyệt.
- YouTube Shorts được quét qua watch player nền để bắt thêm chất lượng.
- Ép player lần lượt 4K/2K/1080p/720p/480p/... để thu thập URL thực tế.
- Tải YouTube theo từng range để tránh lỗi file vài byte / HTTP 403 do lưu nhầm chunk.
- Với video MP4 tách tiếng, BaByLon ghép MP4 + M4A ngay trong tiện ích bằng muxer riêng, không re-encode.
- Tải phụ đề YouTube công khai thành SRT.
- Không giả đổi đuôi audio thành MP3.


BaByLon 1.28 FAST SCAN:
- YouTube Shorts quét trực tiếp tab hiện tại trước, không tự mở /watch nền ngay từ đầu.
- Nếu player response đã có >=4 mức video + audio thì bỏ qua vòng đổi chất lượng.
- Vòng đổi chất lượng giảm từ ~3.2 giây/mức xuống dưới ~0.9 giây/mức.
- Tối đa 7 mức chất lượng và ưu tiên mức cao.
- Chỉ mở player /watch nền khi Shorts hiện tại thực sự không lộ đủ dữ liệu.
- Mục tiêu quét thông thường khoảng 1-7 giây thay vì 20-30+ giây.


BaByLon 1.29 - Media Center
- Không sao chép mã nguồn/tài nguyên của Video DownloadHelper; module được viết độc lập.
- Tự phát hiện response video/audio công khai bằng chrome.webRequest và lưu cache riêng theo tab.
- Mở Tải video có thể hiện media đã bắt được ngay, không bắt buộc quét sâu.
- Quét sâu YouTube là tùy chọn riêng để tránh chờ lâu.
- Thêm mở thư mục Downloads, lịch sử tải, xóa mục hoàn tất.
- Hỗ trợ tab web thông thường ngoài các nền tảng đã có khi bắt được media trực tiếp.
- Không hỗ trợ DRM/nội dung bị khóa; MP3 chỉ khi nguồn là MP3.


BaByLon 1.30 YouTube Detector:
- Quét nhanh YouTube nay attach Network capture trong thời gian ngắn, không chỉ quét sâu.
- Kích một media burst nhỏ để bắt URL googlevideo hiện tại rồi khôi phục trạng thái phát.
- Thêm fallback Innertube từ chính context của trang để lấy streamingData khi player DOM thiếu URL.
- Giữ cache media trong tab YouTube SPA thay vì xóa ngay mỗi lần URL playlist/watch thay đổi.
- Nếu chỉ thấy phụ đề, UI giải thích rõ và hướng dẫn quét lại/quét sâu.


BaByLon 1.31 YT Network Recovery:
- Sửa fast probe: seek tới vùng chưa buffer thay vì chỉ nhích +0.22 giây.
- Quét nhanh tự fallback một probe khẩn cấp nếu chỉ thấy phụ đề.
- Cho phép hiển thị response googlevideo thật từ Network ngay cả khi URL mới không lộ itag.
- Vẫn không giải mã DRM hay luồng bị khóa.


BaByLon 1.32:
- YouTube downloader rewritten to prefer direct player formats from multiple Innertube clients (WEB, ANDROID_VR, WEB_EMBEDDED, IOS, TV).
- Generic network byte-range responses are no longer shown as complete videos.
- Progressive video/audio uses Chrome native download instead of saving an arbitrary network segment as .mp4.
- High-quality adaptive formats are shown only when a real video format and compatible audio format are available.
- Network capture is now fallback/augmentation, not the primary source of download candidates.
- Added GoogleVideo XHR header compatibility for in-extension merge fetches.


BaByLon 1.33.1 HOTFIX:
- Sửa nút Phân tích YT không click/chuyển trang được.
- Thêm ytAnalyticsPage vào danh sách trang hợp lệ của bộ điều hướng.
- Gắn event click cho tabYtAnalytics ở cả popup và side panel.
- Không thay đổi logic các chức năng khác.


BaByLon 1.34 YouTube Analytics Deep Reader:
- Cuộn sâu toàn bộ 4 trang Studio thay vì chỉ đọc vùng đầu màn hình.
- Thu thập dữ liệu nhiều lần ở các vị trí cuộn khác nhau để kích hoạt lazy-load.
- Đọc cấu trúc card + aria-label, không chỉ dựa vào body.innerText.
- Fallback sang Reach/Engagement khi CTR/Impressions/AVD vẫn thiếu.
- Bổ sung Average Percentage Viewed, Unique Viewers, Monetized Playbacks, Ad Revenue.
- Cải thiện heatmap Khi người xem của bạn ở trên YouTube.


BaByLon 1.35 - YouTube Analytics API Deep:
- Đọc 3 lớp: Studio API nội bộ (get_screen), response Network youtubei, và DOM Studio.
- Dùng debugger Network trong tab Studio nền để lấy JSON mà chính YouTube Studio tải.
- Đối chiếu các chỉ số thay vì chỉ đọc chữ đang hiển thị trên màn hình.
- Bổ sung engaged views, Shorts feed, stayed to watch, likes/comments/shares, realtime 48h khi Studio cấp.
- Nếu Studio không trả AVD/RPM nhưng có đủ tổng số liệu, BaByLon tính chính xác và đánh dấu nguồn 'Tính toán'.
- Không tự bịa CTR/CPM/audience nếu Studio không cung cấp.


BaByLon 1.39 - Facebook Duyệt bài Fast/Auto Fix
- Scan dùng MutationObserver + cuộn nhanh, không chờ 3 phút khi Facebook tải chậm.
- Tự động duyệt xử lý ngay bài đang hiển thị rồi cuộn tiếp, không đợi scan toàn bộ trước.
- Fix Facebook virtualized DOM khiến auto chỉ thấy bài ở cuối danh sách.
- REVIEW/NEED_INFO được giữ lại, không tự từ chối nhầm.
- Có thể chuyển từ Scan sang Tự động duyệt; tác vụ cũ sẽ dừng.
- Bộ click Facebook được gia cố và phiên bản content script được kiểm tra để hotfix có hiệu lực.


=== BaByLon 1.40 - FB Job Filter ===
- Fix lỗi mọi bài bị từ chối vì chữ "Chia sẻ" trên nút Facebook bị hiểu nhầm là repost.
- Bài tìm việc/ứng tuyển được ưu tiên duyệt.
- Tin tuyển người hợp lệ được duyệt; sale/inbox/TikTok không còn bị coi là spam khi nằm trong tin việc làm.
- Chỉ tự từ chối spam/rủi ro rõ hoặc quảng cáo bán hàng không liên quan; bài chưa rõ giữ REVIEW.
- Cùng một người có nhiều bài đang chờ: chỉ duyệt 1 bài, các bài sau từ chối để chống spam.


BaByLon 1.41 - 12 VIDEO CŨ NHẤT CHÍNH XÁC
- Đổi định nghĩa hiển thị thành “12 video cũ nhất của kênh”.
- Không dùng 12 phần tử cuối playlist Uploads làm nguồn chính nữa.
- Mở đồng thời Video / Shorts / Live, chọn chip Cũ nhất (Oldest) của chính YouTube.
- Lấy tối đa 12 ứng viên cũ nhất ở mỗi loại, đọc metadata/ngày đăng thật, gộp rồi sắp xếp tăng dần theo ngày.
- Chọn đúng 12 video có ngày đăng sớm nhất còn công khai trên toàn kênh.
- Playlist Uploads chỉ là fallback nếu YouTube đổi UI và không thể bấm Cũ nhất.


BaByLon 1.42 - NEWEST/OLDEST 12 TRUTH FIX
- Fix nghiêm trọng: 1.41 có thể click Cũ nhất thất bại trong tab nền nhưng vẫn lấy card Mới nhất rồi gắn nhãn là Cũ nhất.
- Chỉ chấp nhận nhóm Cũ nhất khi xác minh card đầu đã đổi hoặc chip Cũ nhất thật sự selected.
- Nếu không xác minh được chip, BaByLon quay về Mới nhất, cuộn HẾT tab và lấy 12 card cuối; chậm hơn nhưng đúng.
- Bộ đọc card chỉ quét trong grid nội dung của kênh, không lấy nhầm video sidebar/header.
- 12 nội dung Mới nhất luôn lấy từ card Mới nhất của Video/Shorts/Live; playlist Uploads chỉ bổ sung, không còn là nguồn duy nhất.
- Nếu metadata của một video lỗi, vẫn giữ video trong mẫu để UI không báo sai 0 nội dung.
- Đổi cache trạng thái job sang V142 để không hiển thị lại kết quả sai của 1.41 sau Reload.


1.42.5 FB Approve Repost False-Positive Fix
- Không còn coi nhãn Facebook “Chia sẻ bài viết/Share post” là repost.
- Chỉ nhận repost khi có nguồn rõ: “đã chia sẻ bài viết của/từ …”, “shared … from …”.
- Repost có nội dung tuyển người/tìm việc vẫn được xét DUYỆT bình thường.
- Repost không rõ nội dung việc làm => REVIEW, không tự TỪ CHỐI.


1.42.6 - FB Job Admin Rules
- Tự duyệt bài có từ khóa tìm việc/ứng viên sau khi qua lớp spam/clone.
- Duyệt bài tuyển nhân viên phù hợp nhóm; bài chỉ nhắc tỉnh khác Đà Nẵng được giữ REVIEW.
- Từ chối từ khóa spam: chốt đơn, nhận hoa hồng, việc nhẹ lương cao, mẹ bỉm, cho vay + biến thể rủi ro.
- Từ chối tài khoản <30 ngày hoặc không avatar khi Facebook thực sự hiển thị được tín hiệu đó; không đoán khi dữ liệu không có.
- Ghi nhớ mỗi tài khoản đã được duyệt trong ngày theo từng Group bằng chrome.storage.local.
- Nếu cùng tài khoản có nhiều bài đang chờ trong ngày, chỉ bài đầu tiên được phép duyệt; bài sau từ chối.
- Khi từ chối vì vượt 1 bài/ngày, thử gửi tin nhắn: "Mỗi thành viên chỉ được đăng tối đa 1 bài/ngày".
- AI không được ghi đè bộ quy tắc này.


## 1.42.7 - FB content-risk moderation
- Bỏ giới hạn cứng 1 bài/ngày và không còn tự từ chối chỉ vì nick mới/không avatar.
- Duyệt bài việc làm/tìm việc bình thường theo nội dung.
- Từ chối ngay bài vay vốn/giải ngân/thu phí/đặt cọc, dấu hiệu lừa đảo, cá cược/đa cấp, buôn bán quảng cáo không liên quan.
- Phân biệt nghề "nhân viên bán hàng/sales" với bài bán sản phẩm.
- Chỉ coi repost khi có nguồn nhóm khác thực sự; không dùng nút "Chia sẻ" của Facebook làm tín hiệu.
- Bài không rõ ràng giữ lại để quản trị viên xem nhằm tránh từ chối nhầm.

## 1.42.8 - FB scan search
- Sau khi Scan hoặc Tự động duyệt, lưu kết quả theo từng Facebook Group để tra cứu lại ngay cả khi đóng/mở BaByLon.
- Thêm ô tìm nhanh theo tên người đăng hoặc nội dung; lọc Duyệt / Từ chối / Giữ lại.
- Hiển thị rõ SẼ DUYỆT/SẼ TỪ CHỐI khi chỉ Scan và ĐÃ DUYỆT/ĐÃ TỪ CHỐI sau khi Auto thực sự bấm.
- Nút Tới bài tìm card tương ứng trên trang pending posts và đánh dấu bài bằng viền xanh.


1.42.9 - FB Scan Search Larger Results
- Tăng vùng cuộn danh sách bài đã quét từ 280px lên 390px.
- Tăng chiều cao iframe Duyệt bài lên 590px để tận dụng khoảng trống của side panel.
- Giữ nguyên toàn bộ logic Scan/Tự động duyệt của 1.42.8.


1.42.10
- Duyệt bài Facebook: nội dung không đủ rõ giờ tự động REJECT thay vì giữ lại.
- Thêm bộ đếm Sẽ/Đã duyệt, Sẽ/Đã từ chối và Tổng số bài ngay trên danh sách kết quả.


V1.42.11 - Check Giờ đăng: hỗ trợ cả video và bài viết/ảnh. Facebook: posts/permalink/photo/story/reel/video; YouTube: video/Shorts/live/Community; TikTok: video/photo. Thêm đọc time/datetime, data-utime, embedded timestamp và relative time.

V1.42.12 - Facebook pending scan exact-count: quét nhiều lượt từ đầu đến cuối, bước cuộn nhỏ, lấy card từ nút Phê duyệt/Từ chối, không loại nhầm bài có phần mở đầu giống nhau; cố đạt đúng tổng bài Facebook hiển thị.

V1.42.13 - Facebook pending scan truth: loại nút duyệt hàng loạt khỏi card scan; quét từng card theo thứ tự DOM từ đầu đến cuối; mỗi pass độc lập để tránh duplicate do virtualized DOM; chỉ báo đủ khi một pass xác thực đúng số bài Facebook hiển thị.


V1.42.15 - Facebook Duyệt bài F5 Reset Scan
- Chỉ riêng Duyệt bài: F5/Ctrl+R trang /groups/<id>/pending_posts sẽ xóa toàn bộ kết quả quét/tìm kiếm của đợt trước.
- Đóng/mở BaByLon mà không F5 vẫn giữ kết quả quét để tra cứu.
- Không xóa lịch sử giới hạn 1 bài/24 giờ; người đã được duyệt trong 24 giờ vẫn được nhận diện sau F5.
- Không thay đổi cache của Keywords, Tải video, Check giờ, Check IP hay các chức năng khác.


V1.42.16 - Facebook Auto Moderation Verified Action
- Auto chỉ bắt đầu khi quét xác thực đúng N/N bài.
- Không cho phép tiến trình vượt N/N (không còn 14/13).
- Xử lý theo snapshot từng bài, tìm lại đúng card rồi bấm.
- Chỉ tính Đã duyệt/Đã từ chối khi Facebook thực sự bỏ card/nút hoặc số bài chờ giảm.
- Nếu click không được, ghi lỗi thao tác thay vì giả vờ đã xử lý.


V1.42.20 - Restore 1.42.16 Scan + Auto Execute Scan List Only
- Khôi phục nguyên logic Scan bài chờ duyệt của 1.42.16.
- Không chỉnh selector, loadAllPosts, scanPendingPosts, dedupe hay cách đếm bài của Scan.
- Tự động duyệt bắt buộc dùng đúng danh sách SẼ DUYỆT / SẼ TỪ CHỐI từ lần Scan gần nhất.
- Auto không gọi scanPendingPosts/loadAllPosts/build24hModerationPlan/evaluatePost để phân loại lại.
- Auto chỉ tìm đúng card và bấm Phê duyệt/Từ chối theo snapshot đã Scan, sau đó xác minh Facebook đã áp dụng.


BaByLon 1.42.21
- Thêm Đọc 2FA TOTP cục bộ: hỗ trợ secret Base32 và otpauth://; không lưu secret vào chrome.storage.


BaByLon 1.42.22
- Đọc 2FA: thêm nút × xóa nhanh secret/mã hiện tại, dừng timer và focus ô nhập để dán mã mới ngay.


1.42.24: Đọc 2FA thêm nút 📋 cạnh ô Secret để sao chép nhanh Secret Base32; giữ nguyên nút sao chép mã TOTP hiện tại.


1.42.25 - Duyệt bài: sửa nhận diện cùng tác giả trong một đợt scan (fallback theo tên khi thiếu profile ID); mỗi tác giả tối đa 1 bài/24h; các bài dư luôn từ chối với lý do trùng tần suất, không còn cùng nội dung nhưng một bài bị gắn nhầm quảng cáo. Giữ nguyên cơ chế Scan ổn định hiện tại.

1.42.26 - Duyệt bài: không tự duyệt bài đầu tiên của tác giả. Mọi bài phải chạy kiểm duyệt nội dung/rủi ro trước; chỉ bài đầu tiên theo thời gian vượt kiểm duyệt mới được duyệt, các bài an toàn sau đó bị loại theo giới hạn 1 bài/24h. Các bài giống nhau của cùng tác giả dùng cùng kết quả kiểm duyệt theo bài đăng sớm nhất để tránh một bài duyệt, một bài bị gắn nhầm quảng cáo. Không thay đổi cơ chế Scan.

1.42.27 - Duyệt bài: với cùng tác giả có nhiều bài trong 24h, chỉ kiểm duyệt bài đăng sớm nhất. Nếu bài đầu không đạt thì từ chối toàn bộ bài của tác giả; nếu bài đầu đạt thì chỉ duyệt bài đầu và từ chối toàn bộ bài sau theo giới hạn 1 bài/24h. Không evaluate lại các bài sau nên các bài giống hệt nhau không còn lý do mâu thuẫn. Quyết định được lưu theo object bài để tránh collision postKey. Không thay đổi cơ chế Scan.

BaByLon 1.42.28 - Lịch âm Việt Nam
- Bổ sung lịch âm ngay trong chức năng Check giờ.
- Hiển thị ngày/tháng/năm âm lịch, tháng nhuận nếu có.
- Hiển thị Can Chi của ngày, tháng và năm.
- Tính cục bộ theo lịch âm Việt Nam UTC+7, không dùng API ngoài.
- Nút Copy giờ kèm luôn thông tin âm lịch.
- Giữ nguyên logic Scan/Duyệt bài của 1.42.27.


BaByLon 1.42.29
- Check giờ: thêm ảnh cờ quốc gia cục bộ cho quốc gia đang chọn, tiêu đề đồng hồ, ô thông tin và truy cập nhanh.
- Dùng file cờ PNG đi kèm tiện ích nên Windows không còn hiển thị cờ thành chữ VN/US/GB.
- Không thay đổi các chức năng khác.


BaByLon 1.42.30 — Dịch ngôn ngữ: dịch văn bản/SRT hơn 100 ngôn ngữ, tự phát hiện nguồn, giữ timestamp SRT, copy kết quả.


BaByLon 1.42.31 — Translator AI: bỏ Google Translate; dùng OpenAI Responses API với GPT-5.6 Sol/Terra/Luna, API key chỉ giữ trong phiên; thêm cờ đại diện ngôn ngữ và kiểm tra cấu trúc SRT.

BaByLon 1.42.32 — Translator: bỏ GPT/OpenAI ở chức năng Dịch ngôn ngữ; chuyển sang DeepL API chính thức, ưu tiên quality-optimized, hỗ trợ SRT theo cue + context, tự chọn endpoint API/API Free, giữ cờ ngôn ngữ.

BaByLon 1.42.35
- DeepL Translator: chọn trực tiếp file .srt, xem trước SRT nguồn, dịch giữ nguyên số thứ tự/timestamp.
- Xem trước SRT đã dịch, đặt tên file và tải xuống .srt UTF-8.


BaByLon 1.42.38
- Tích hợp sẵn DeepL API key mặc định trong tiện ích.
- Bản cài mới / Chrome khác tự nạp API, không cần nhập thủ công.
- Vẫn cho phép thay key khác; key thay thế được lưu trong chrome.storage.local.


BaByLon 1.42.38
- Check giờ: thêm Đếm ngày trước / sau theo ngày hiện tại của múi giờ đang chọn.
- Nhập số ngày (ví dụ 10), bấm Ngày trước hoặc Ngày sau để xem ngày cụ thể.

- 1.42.38: Thêm tính chênh lệch giữa 2 ngày và giữa 2 mốc giờ trong Check giờ.


BaByLon 1.42.39
- Đổi ô Từ ngày / Đến ngày sang bộ chọn lịch native của Chrome.
- Đổi ô Từ giờ / Đến giờ sang bộ chọn giờ native của Chrome.
- Click trực tiếp vào ô sẽ mở lịch / giờ; chọn xong tự tính khi đủ 2 mốc.
- Cập nhật cho cả popup và side panel.


BaByLon v1.42.40
- Ô chọn giờ ở mục Tính khoảng cách ngày / giờ dùng chuẩn 24 giờ.
- Giới hạn giờ từ 00:00 đến 23:59, bước 1 phút.
- Áp dụng cho cả Popup và Side Panel.


BaByLon v1.42.41
- Bỏ hoàn toàn bộ chọn giờ native của Chrome vì Windows có thể ép hiển thị SA/CH (AM/PM).
- Thay bằng bộ chọn 24 giờ riêng: Giờ 00–23 và Phút 00–59, luôn hiển thị HH:MM.
- Chính xác từng phút, không phụ thuộc ngôn ngữ/định dạng giờ của Windows hoặc Chrome.
- Áp dụng cho cả Popup và Side Panel.



BaByLon v1.42.42
- Sửa cách tính chênh lệch giờ theo chiều thời gian.
- Nếu giờ kết thúc nhỏ hơn giờ bắt đầu, tự hiểu là qua 0:00 sang ngày hôm sau.
- Ví dụ: 23:59 -> 06:16 = 6 giờ 17 phút.


BaByLon v1.42.43
- Sắp xếp lại giao diện Check giờ.
- Chuyển “Đếm ngày trước / sau” và “Tính khoảng cách ngày / giờ” xuống cuối mục Check giờ, sau thông tin quốc gia/múi giờ và Truy cập nhanh.
- Không thay đổi logic tính ngày/giờ.


BaByLon v1.42.44
- Dịch SRT hàng loạt: chọn tối đa 8 ngôn ngữ đích cho một file SRT nguồn.
- Dịch tuần tự qua DeepL để ổn định, giữ nguyên số thứ tự và timestamp cho từng file.
- Hiển thị trạng thái từng ngôn ngữ, xem trước từng file, đổi tên và tải riêng.
- Thêm Tải tất cả (.ZIP) để lấy các file SRT đã dịch trong một lần tải.
- Chế độ dịch văn bản / dịch SRT một ngôn ngữ cũ vẫn giữ nguyên.


BaByLon v1.42.45
- Chế độ dịch nhiều file SRT chọn sẵn 8 ngôn ngữ mặc định: Anh, Đức, Pháp, Nhật, Hàn, Tây Ban Nha, Bồ Đào Nha, Hà Lan.
- Thứ tự mặc định: EN → DE → FR → JA → KO → ES.
- Bấm Xóa/Reset sẽ khôi phục lại 6 ngôn ngữ mặc định; vẫn có thể tùy chỉnh tối đa 8 ngôn ngữ.


BaByLon v1.42.46
- Nâng chất lượng dịch SRT DeepL: dùng context ẩn lấy từ chính các câu SRT xung quanh; context không được xuất ra file.
- Thêm custom_instructions cho các ngôn ngữ DeepL hỗ trợ để giữ đúng chủ thể/đại từ, dịch tiếng lóng tự nhiên, không thêm/bớt/giải thích và giữ câu phụ đề ngắn gọn.
- Khi dùng custom_instructions, ưu tiên model quality_optimized; nếu API/cặp ngôn ngữ không hỗ trợ thì tự fallback về dịch với context ẩn để không làm gián đoạn.
- Giữ nguyên 1 cue nguồn -> 1 cue dịch, số thứ tự và timestamp không thay đổi.


BaByLon 1.42.55 — Gemini-only + multi API sync
- Xóa DeepL khỏi giao diện và host permission của chức năng Dịch ngôn ngữ.
- Thêm Kho Gemini API: tối đa 20 key, tự chuyển key khi 401/403/429 sau khi thử model dự phòng.
- API list + API ưu tiên được lưu Chrome Sync và backup local.
- Thêm manifest key cố định để bản unpacked giữ cùng extension ID giữa các máy/Chrome khi dùng cùng bộ mã.


V1.42.77 - Approve: reject external Group shares immediately
- Bài chia sẻ/repost từ Facebook Group khác bị REJECT trước mọi kiểm tra nội dung/tài khoản/1 bài 24h.
- Nhận diện thêm link tên Group khác trong khung share, không chỉ link /posts hoặc /permalink.
- Bài share bị loại không làm ảnh hưởng phép chọn bài gốc của cùng tác giả trong quy tắc 1 bài/24h.


V1.42.78 - Move Time Zone Calculator to Check giờ + expand US time zones
- Moved Máy tính khung giờ out of Giờ đăng into Check giờ.
- Added US Eastern, Central, Mountain, Pacific, Arizona, Alaska and Hawaii zones with IANA/DST handling.
- Added US quick-zone buttons and auto-seeded calculator with current time.


BaByLon v1.42.81
- Browser Downloader: chạy 100% trong Chrome, không cần yt-dlp/Native Helper/FFmpeg.
- Quét Player/DOM + request media + dữ liệu trực tiếp YouTube.

BaByLon v1.42.82
- Thêm chức năng Flow Batch Creator (bản thử) cho Google Flow.
- Dán nhiều prompt, tách bằng --- / mỗi dòng / dòng trống / dấu tùy chỉnh.
- Hàng đợi tối đa 100 prompt, trạng thái Chờ / Đang gửi / Đã gửi / Lỗi.
- Điều khiển Bắt đầu / Tạm dừng / Tiếp tục / Dừng / Chạy lại lỗi.
- Có thể thử chọn chế độ Ảnh / Video trên Flow hoặc giữ nguyên chế độ hiện tại.
- Tự thử lại khi lỗi, tự tạm dừng nếu phát hiện dấu hiệu giới hạn/chặn.
- Không dùng API riêng; thao tác trực tiếp trên giao diện flow.google.com đang mở.


BaByLon v1.42.87
- Thêm Tải Series tự động cho TikTok dạng nhiều tập.
- Tự chuyển nhóm tập 1-24, 25-48... và từng tập.
- Ưu tiên thao tác nút tải Cốc Cốc nếu lớp tải nằm trong DOM; nếu không, chế độ mặc định tự dùng Browser Downloader của BaByLon.
- Có khoảng tập, thời gian chờ, thử lại, tạm dừng/dừng và nhật ký.


BaByLon v1.42.87
- TikTok Series: trước khi tải tập ngoài nhóm hiện tại, tự bấm tab nhóm chứa tập (vd 25-45), chờ danh sách render rồi mới bấm tập.
- Retry riêng thao tác chuyển nhóm nếu TikTok render chậm.


BaByLon v1.42.92: AssistiveTouch được tăng cường để tự xuất hiện trên mọi trang web http/https trong Chrome và Cốc Cốc, tự chèn lại sau SPA/navigation và chống CSS trang web ẩn nút. Trang hệ thống chrome:// / coccoc:// vẫn bị trình duyệt chặn injection.
