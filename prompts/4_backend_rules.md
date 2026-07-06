# Quy tắc xử lý ở tầng backend (KHÔNG thuộc system prompt)

Những nội dung dưới đây là code/logic dev tự xử lý, không nên và không cần đưa vào system prompt gửi model mỗi lượt.

## 1. Regex hỗ trợ (double-check song song với model, không thay thế)
- SĐT Việt Nam: `(0|\+84)(3|5|7|8|9)[0-9]{8}` — bắt số điện thoại kể cả khi lẫn trong câu dài.
- Chạy regex này song song với bước trích xuất bằng model để tránh bỏ sót số điện thoại khi câu khách quá dài hoặc viết tắt.

## 2. Chuẩn hoá dữ liệu khi trích xuất
- **Ngân sách**: quy về 1 đơn vị chung (triệu đồng/tháng), nhận diện các dạng: "40 triệu", "40tr", "40 củ", "40 chai", "4 chục", "40", "dưới 50", "tối đa 45".
- **Diện tích**: nhận diện "5x20", "5 x 20", "100m", "100 mét", "100m²", "100 m2" đều quy về cùng 1 định dạng chuẩn.
- Việc chuẩn hoá này có thể để model làm ngay lúc trích xuất state (structured extraction), hoặc thêm 1 lớp hậu xử lý bằng code nếu cần độ chính xác cao hơn cho việc matching sau này.

## 3. Lead quality (dùng luật rõ ràng — không để model tự "cảm nhận")
Tính theo luật cụ thể dựa trên state đã lưu, không suy diễn chủ quan:
- **Nóng**: có `contact` + `budget` + `area` + (`urgent`=true HOẶC đã đủ cả 6 trường bắt buộc)
- **Ấm**: có `contact` nhưng thiếu 1-2 trường bắt buộc khác
- **Lạnh**: chưa có `contact`, hoặc chỉ mới cho 1-2 trường rồi dừng tương tác

Tag này chỉ phục vụ nội bộ (CRM sắp xếp thứ tự chăm sóc), không hiển thị cho khách và không thay đổi cách bot trả lời khách trong hội thoại đang diễn ra.

## 4. Giới hạn lặp câu hỏi
Tối đa hỏi 1 trường 2 lần liên tiếp (đã có hướng dẫn đổi cách hỏi trong system prompt, mục 3.5-h). Nếu vẫn không ra kết quả sau lần thứ 3, backend nên tự động chuyển field đó vào `unclear_fields` và không để model tiếp tục cố hỏi.

## 5. Follow-up chủ động sau khi khách "mất tích"
Đây là việc của tầng ứng dụng (cron job / scheduled trigger đọc state đã lưu và tự gửi tin), không phải thứ model tự quyết định giữa 1 phiên hội thoại đang diễn ra.
- Chỉ follow-up nếu khách đã ở lại đủ lâu để có state có giá trị (ít nhất đã cho biết mục đích + 1-2 trường khác).
- Tần suất hợp lý: thường chỉ 1 lần follow-up là đủ, tránh spam gây khó chịu và ảnh hưởng uy tín.
- Nội dung nên tham chiếu đúng state đã lưu để cá nhân hoá:
> "Dạ anh/chị hôm trước có nhắn cần thuê mặt bằng mở spa khu Quận 1, ngân sách khoảng 50 triệu ạ. Bên em vừa có thêm vài căn khá sát nhu cầu nên nhắn anh/chị xem thử ạ."
- Nếu nền tảng nhắn tin yêu cầu opt-in (Zalo OA, Facebook Messenger 24h policy...) thì cần tuân thủ đúng quy định của nền tảng đó trước khi gửi tin chủ động ngoài khung giờ cho phép.

## 6. Định hướng khi mở rộng thêm (Lead Scoring nâng cao, CRM Memory, Matching Engine...)
Giữ nguyên tắc: system prompt (`1_system_prompt_core.md`) chỉ nên chứa **quy tắc hành vi hội thoại** — thứ model phải áp dụng real-time để sinh ra câu trả lời đúng (phản hồi trước-hỏi sau, micro-selling, anti-loop, escalation, xử lý ngoại lệ...). Còn **dữ liệu/cấu hình sẽ thay đổi theo thời gian** (kiến thức ngành, mapping, công thức tính điểm, quy tắc CRM, regex) nên nằm ở các file riêng như đã tách, đọc từ state đã lưu ở tầng ứng dụng.

Gợi ý kiến trúc tổng thể khi hệ thống lớn dần:
```
1. Conversation Prompt (1_system_prompt_core.md — hành vi hội thoại)
        ↓
2. State Extractor (structured extraction mỗi lượt chat → 3_state_schema.md)
        ↓
3. Validation (regex, chuẩn hoá dữ liệu — mục 1, 2 ở trên)
        ↓
4. Matching Engine (ghép state với tồn kho mặt bằng thực tế — không có trong phạm vi các file này)
        ↓
5. Lead Scoring (mục 3 ở trên)
        ↓
6. CRM Memory (lưu trữ lịch sử, pain_point, objection theo từng khách)
        ↓
7. Follow-up Scheduler (mục 5 ở trên)
        ↓
8. Human Handoff (kích hoạt khi model trả về tín hiệu escalation — mục 3.5-j trong system prompt)
```
Mỗi thành phần nên độc lập, dễ bảo trì và mở rộng riêng — tránh nhồi tất cả logic vào 1 system prompt duy nhất.
