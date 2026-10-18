# Facebook Auto Invite Likers

Tiện ích Chrome Manifest V3 để tự động bấm nút **Mời/Invite** trong popup danh sách người đã thích bài viết Facebook.

## Cách cài đặt

1. Mở `chrome://extensions/`.
2. Bật **Chế độ dành cho nhà phát triển**.
3. Bấm **Tải tiện ích đã giải nén**.
4. Chọn thư mục `facebook-auto-invite-likers`.

## Cách dùng

1. Mở bài viết Facebook của bạn.
2. Bấm vào số lượt thích/cảm xúc để hiện danh sách người đã thích.
3. Mở tiện ích trên thanh Chrome.
4. Nhập số người muốn mời, độ trễ mỗi lần bấm và thời gian chờ tải tối đa.
5. Bấm **Bắt đầu mời**.

Nên để độ trễ từ 1500 đến 3000 ms và không mời quá nhiều người trong một lần để tránh thao tác quá nhanh.

Nếu Facebook tải chậm, tăng mục **Thời gian chờ tải tối đa** lên 180-300 giây. Tiện ích sẽ tiếp tục chờ và cuộn thêm thay vì tự dừng sau vài lần không thấy nút mời.
