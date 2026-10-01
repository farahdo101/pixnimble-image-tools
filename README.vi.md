# PixNimble Image Tools

Bộ tiện ích xử lý ảnh mã nguồn mở, gọn nhẹ, không cần thư viện phụ. Đây là một phần chức năng được tách và xây dựng độc lập từ dự án **[PixNimble — công cụ ảnh trực tuyến miễn phí](https://pixnimble.com)**.

**[Sử dụng bộ công cụ đầy đủ tại pixnimble.com →](https://pixnimble.com)** · [English](README.md)

## Chức năng

- Tính tỷ lệ khung hình và kích thước resize.
- Nhận diện chữ ký file JPEG, PNG, WebP, GIF, AVIF và HEIC.
- Resize và chuyển đổi JPEG, PNG, WebP trong trình duyệt.
- Demo có xem trước và tải ảnh về, không gửi ảnh lên máy chủ.

## Chạy thử

Cài Node.js 22 trở lên, sau đó:

```sh
git clone https://github.com/farahdo101/pixnimble-image-tools.git
cd pixnimble-image-tools
npm start
```

Mở http://127.0.0.1:4174/demo/. Không cần chạy `npm install`.

Chạy `npm run check` để kiểm tra cú pháp và các bài test.

## Lưu ý

Demo chuyển đổi hỗ trợ JPEG, PNG, WebP; file tối đa 40 MiB, ảnh đầu vào sau giải mã và đầu ra không quá 8.192 px mỗi cạnh và 32 megapixel. Bộ tính kích thước không cấp phát ảnh nên có giới hạn riêng: 1.000.000 px mỗi cạnh.

Chức năng kiểm tra chữ ký không xác nhận file an toàn hay giải mã được. Nhận diện HEIC/AVIF/GIF không đồng nghĩa với hỗ trợ chuyển đổi các định dạng này.

Ảnh đầu ra là ảnh tĩnh; không giữ animation và metadata gốc. JPEG dùng nền trắng. Kích thước file đầu ra không được đảm bảo nhỏ hơn ảnh gốc. Xem đầy đủ giới hạn và API trong [README tiếng Anh](README.md) và [tài liệu API](docs/API.md).

Mã nguồn repo này được cấp phép [MIT](LICENSE). Repo không chứa toàn bộ mã nguồn sản phẩm PixNimble.
