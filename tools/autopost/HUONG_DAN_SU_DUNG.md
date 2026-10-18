# Hướng dẫn sử dụng BinhStar GF 1.2.0

## 1. BinhStar GF làm gì?

BinhStar GF hỗ trợ đăng lần lượt cùng một bài viết vào các nhóm xuất hiện trên trang kết quả tìm kiếm Nhóm của Facebook.

Trong mỗi phiên, tiện ích sẽ:

1. Quét kết quả từ trên xuống dưới theo đúng thứ tự hiển thị.
2. Bỏ qua số nhóm đầu tiên nếu bạn đã thiết lập.
3. Kiểm tra bài của bạn trong cả hai mục **Đã đăng** và **Đang chờ** của từng nhóm.
4. Bỏ qua nhóm nếu phát hiện bài dưới 24 giờ.
5. Nếu đủ điều kiện, mở trình tạo bài viết, nhập caption, tải ảnh/video và nhấn **Đăng**.
6. Quay lại danh sách và tiếp tục với nhóm kế tiếp.

> Tiện ích chỉ hỗ trợ thao tác trên giao diện Facebook. CAPTCHA, câu hỏi tham gia, checkpoint và phê duyệt của quản trị viên vẫn do Facebook hoặc người dùng quyết định.

## 2. Cài đặt hoặc cập nhật tiện ích

### Google Chrome

1. Mở `chrome://extensions`.
2. Bật **Chế độ dành cho nhà phát triển**.
3. Chọn **Tải tiện ích đã giải nén**.
4. Chọn thư mục chứa `manifest.json` của BinhStar GF.
5. Ghim biểu tượng chữ **B** lên thanh công cụ.

### Microsoft Edge

Thực hiện tương tự tại `edge://extensions`.

Sau mỗi lần cập nhật mã nguồn, hãy bấm **Tải lại** trên thẻ BinhStar GF. Nếu đang có phiên chạy, hãy dừng phiên cũ trước khi tải lại.

## 3. Khởi động nhanh

1. Đăng nhập đúng tài khoản Facebook cần sử dụng.
2. Tìm từ khóa mong muốn, sau đó chọn bộ lọc **Nhóm**.
3. Đảm bảo địa chỉ trang có dạng `facebook.com/search/groups/?q=...`.
4. Mở BinhStar GF trên chính tab kết quả đó.
5. Dán caption và chọn ảnh hoặc video.
6. Thiết lập phạm vi nhóm và thời gian nghỉ.
7. Bật **Gửi yêu cầu tham gia nhóm** nếu cần.
8. Bấm **Bắt đầu** và giữ nguyên tab Facebook cho đến khi hoàn tất hoặc tạm dừng.

Không cần cuộn trang trước. Tiện ích sẽ tự cuộn để thu thập đủ kết quả.

## 4. Thiết lập nội dung bài đăng

### Caption

- Nội dung trong ô **Caption** chính là nội dung được đăng lên Facebook.
- Khoảng trắng, emoji và các lần nhấn Enter được giữ lại.
- Muốn xuống dòng trên Facebook, phải có ký tự xuống dòng thật trong Caption; dòng tự ngắt do chiều rộng ô nhập không được tính là xuống dòng.
- Caption được lưu cục bộ để không mất khi đóng popup hoặc tải lại trang.

Nên thử trước với 1 nhóm để kiểm tra định dạng, emoji và đường xuống dòng.

### Ảnh hoặc video

- Có thể chọn nhiều ảnh cho một bài viết.
- Nếu dùng video, chỉ chọn một video và không chọn kèm ảnh.
- Media được lưu cục bộ và có thể dùng lại sau khi tải lại trang.
- **Xóa media**: chỉ xóa ảnh/video đang lưu.
- **Làm mới nội dung**: xóa caption, media và đặt lại các thiết lập về mặc định.

## 5. Thiết lập phạm vi nhóm

### Bỏ qua nhóm đầu

Đây là số kết quả ở đầu danh sách không được xử lý. Nhập `20` nghĩa là bỏ qua kết quả 1–20 và bắt đầu tại kết quả 21.

### Số lượng nhóm

Đây là số nhóm cần xử lý trong phiên, không phải vị trí kết thúc. Có thể nhập từ 1 đến 100.

| Bỏ qua nhóm đầu | Số lượng nhóm | Phạm vi được xử lý |
|---:|---:|---|
| 0 | 20 | Nhóm 1–20 |
| 20 | 50 | Nhóm 21–70 |
| 100 | 100 | Nhóm 101–200 |

Tiện ích phải cuộn và thu thập tổng cộng `Bỏ qua + Số lượng`. Nếu Facebook không còn kết quả hoặc không tải thêm, phiên có thể có ít nhóm hơn yêu cầu.

### Nghỉ giữa hai nhóm

- Đơn vị là giây.
- Giá trị tối thiểu là 5 giây.
- Thời gian nghỉ bắt đầu sau khi một nhóm được đăng hoặc bỏ qua.

## 6. Gửi yêu cầu tham gia nhóm

Khi bật công tắc:

- Tiện ích bấm **Tham gia** nếu tìm thấy nút phù hợp.
- Nếu nhóm vẫn cho phép tạo bài, tiện ích tiếp tục đăng.
- Nếu yêu cầu đang chờ và chưa được đăng, nhóm bị bỏ qua.
- Nếu có câu hỏi tham gia, nhóm được ghi nhật ký là cần xử lý thủ công.

Khi tắt công tắc, tiện ích không gửi yêu cầu tham gia nhưng vẫn đăng vào bất kỳ nhóm nào đang cho phép tài khoản tạo bài.

## 7. Quy tắc kiểm tra 24 giờ

Trước khi đăng, BinhStar GF kiểm tra theo thứ tự:

1. Mở mục **Đã đăng**.
2. Nếu thấy bài `Vừa xong`, theo giây, phút hoặc từ 1 đến 24 giờ: bỏ qua nhóm ngay.
3. Nếu không có bài mới ở Đã đăng: mở mục **Đang chờ**.
4. Nếu Đang chờ có bài dưới 24 giờ: bỏ qua nhóm.
5. Nếu không có bài hoặc bài đã hiển thị theo ngày/tuần/tháng/năm: cho phép tiếp tục đăng.
6. Nếu Facebook không tải hoặc không đọc được dữ liệu trong khoảng chờ tối đa: bỏ qua để tránh đăng trùng.

Việc kiểm tra trang Facebook được kết hợp với lịch sử phiên cục bộ. Một nhóm đã xử lý gần đây sẽ không được vào lại trong thời hạn bảo vệ.

## 8. Điều khiển phiên

### Bắt đầu

Tạo hàng đợi mới theo các thiết lập hiện tại. Nút này chỉ hoạt động khi tab đang mở đúng trang kết quả tìm kiếm Nhóm.

### Tạm dừng

Dừng trước bước kế tiếp và giữ lại hàng đợi cùng vị trí hiện tại. Một thao tác Facebook đang diễn ra có thể cần hoàn tất trước khi trạng thái chuyển sang tạm dừng.

### Tiếp tục

Chạy tiếp từ vị trí đã lưu. Nhóm đã xử lý không được quay lại; nhóm kế tiếp vẫn theo đúng thứ tự ban đầu.

### Dừng

Kết thúc phiên hiện tại. Lần bấm **Bắt đầu** sau đó sẽ quét lại và tạo hàng đợi mới.

## 9. Hiểu số liệu tiến trình

- **Đã quét**: số nhóm nằm trong hàng đợi của phiên sau khi áp dụng phần bỏ qua.
- **Đã xử lý**: tổng số nhóm đã hoàn tất, gồm đăng thành công và bỏ qua.
- **Đã đăng**: số nhóm mà thao tác đăng đã được thực hiện và xác nhận theo luồng của Facebook.
- **Bỏ qua**: nhóm có bài dưới 24 giờ, không có quyền đăng, có câu hỏi/CAPTCHA, tải lỗi hoặc không thể xác nhận an toàn.
- Thanh tiến trình = Đã xử lý / Đã quét.

Nhật ký hoạt động cho biết vị trí kết quả, nhóm đang mở, kết quả kiểm tra 24 giờ, thao tác tham gia, tải media và đăng bài.

## 10. Khi nào nhóm bị bỏ qua?

- Có bài trong **Đã đăng** dưới 24 giờ.
- Có bài trong **Đang chờ** dưới 24 giờ.
- Dữ liệu thời gian không tải hoặc không thể đọc chắc chắn.
- Không tìm thấy khu vực tạo bài.
- Chưa có quyền đăng hoặc yêu cầu tham gia vẫn chờ.
- Có câu hỏi tham gia, CAPTCHA, checkpoint hoặc yêu cầu xác minh.
- Facebook không nhận caption/media hoặc không bật nút Đăng.

## 11. Xử lý lỗi thường gặp

### Bấm Bắt đầu nhưng không quét

- Quay về đúng trang `facebook.com/search/groups`.
- Tải lại trang Facebook.
- Dừng phiên cũ rồi thử lại.
- Tải lại BinhStar GF tại `chrome://extensions` nếu vừa cập nhật mã.

### Quét ít hơn số lượng yêu cầu

Facebook có thể hết kết quả hoặc tải thêm quá chậm. Kiểm tra mạng, tải lại trang tìm kiếm rồi chạy lại.

### Phạm vi nhóm bắt đầu sai

Kiểm tra lại hai ô **Bỏ qua nhóm đầu** và **Số lượng nhóm**. Ví dụ muốn bắt đầu ở nhóm 21 và làm 30 nhóm thì nhập lần lượt `20` và `30`, phạm vi sẽ là 21–50.

### Caption không đúng xuống dòng

1. Bấm **Làm mới nội dung**.
2. Dán lại caption nguyên bản.
3. Kiểm tra mỗi vị trí cần xuống dòng có Enter thật.
4. Thử với một nhóm trước khi chạy hàng loạt.

### Không tải được ảnh/video

- Xóa media cũ và chọn lại tệp.
- Không trộn ảnh với video.
- Chờ hình xem trước xuất hiện rồi mới bấm Bắt đầu.

### Không gửi được yêu cầu tham gia

- Kiểm tra công tắc đã bật.
- Xem nhật ký có ghi đã bấm Tham gia hay không.
- Nhóm có câu hỏi phải được xử lý thủ công.

### Phiên đứng ở một nhóm

- Kiểm tra CAPTCHA, hộp thoại xác minh hoặc hộp thoại Facebook đang mở.
- Thử **Tạm dừng** rồi **Tiếp tục**.
- Nếu không phục hồi, bấm **Dừng**, tải lại trang tìm kiếm và tạo phiên mới.

## 12. Lưu ý sử dụng

- Chỉ đăng vào nhóm liên quan và tuân thủ nội quy của từng nhóm.
- Thử 1–3 nhóm trước khi chạy số lượng lớn.
- Không thao tác thủ công trên tab Facebook đang được tiện ích điều khiển.
- Không đóng tab, đổi URL hoặc đăng xuất trong khi chạy.
- Không dùng tiện ích để vượt CAPTCHA, checkpoint hoặc quy trình kiểm duyệt.
- Chrome có thể hiện thông báo BinhStar GF đang gỡ lỗi trình duyệt. Đây là thông báo của quyền `debugger` dùng để mô phỏng nhập liệu và bấm nút.

## 13. Dữ liệu và quyền trình duyệt

- `storage`: lưu caption, thiết lập và trạng thái phiên.
- `tabs`: điều hướng giữa danh sách và từng nhóm.
- `notifications`: báo hoàn thành hoặc cần xử lý.
- `unlimitedStorage`: lưu media cục bộ.
- `debugger`: mô phỏng nhập caption và thao tác nút.
- `https://www.facebook.com/*`: cho phép chức năng chạy trên Facebook.

Dữ liệu đăng nhập Facebook do trình duyệt quản lý. Không chia sẻ hồ sơ Chrome, cookie hoặc thư mục dữ liệu trình duyệt cho người khác.
