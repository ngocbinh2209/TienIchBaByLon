# Facebook Group Auto Moderator

Tiện ích này là một Chrome extension cơ bản để quét và tự động duyệt bài viết chờ duyệt trong Group Facebook theo quy tắc tuyển dụng.

## Tính năng

- Scan các bài viết chờ duyệt trong trang Facebook Group
- Phân loại bài theo quy tắc:
  - `APPROVE` cho bài tìm việc hoặc tuyển dụng hợp lệ
  - `REJECT` cho quảng cáo, spam, cho vay, chửi tục
  - `NEED_INFO` cho tuyển dụng thiếu địa chỉ/giờ làm/lương
  - `REVIEW` khi không rõ ràng
- Tự động click `Duyệt` hoặc `Từ chối` nếu tìm được nút tương ứng

## Cài đặt

1. Mở Chrome.
2. Vào `chrome://extensions`.
3. Bật `Developer mode`.
4. Nhấn `Load unpacked` và chọn thư mục `f:\Code tool\tự động duyệt bài`.
5. Mở trang duyệt bài viết của Group Facebook.
6. Nhấn biểu tượng tiện ích và sử dụng `Scan bài chờ duyệt` hoặc `Tự động duyệt`.

## Cần cung cấp

Để hoàn thiện và hiệu chỉnh chính xác hơn, tôi cần bạn cung cấp:

1. URL màn hình Facebook Group nơi bạn duyệt bài.
2. Một vài ví dụ chính xác nội dung bài chờ duyệt (có thể copy/paste).
3. Nếu bạn muốn tự động click duyệt/từ chối, hãy xác nhận rằng bạn đã sử dụng quyền dev và chấp nhận thao tác trên trình duyệt của mình.
4. Nếu bạn muốn mở rộng danh sách từ khóa, gửi thêm các từ/cụm từ vi phạm đặc thù của nhóm.

## Lưu ý

- Facebook thay đổi cấu trúc DOM thường xuyên. Nếu tiện ích không tìm được bài hoặc nút duyệt/từ chối, cần điều chỉnh lại selector trong `content_script.js`.
- Hiện tại extension dùng các quy tắc từ khóa cơ bản. Bạn có thể mở rộng danh sách `RULES` trong `content_script.js` để phù hợp với nhóm của bạn.
