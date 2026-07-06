# Conversation State — schema tham khảo

State nên được trích xuất riêng mỗi lượt chat (function calling / structured extraction), lưu lại, rồi mới đưa state hiện tại vào prompt cùng `1_system_prompt_core.md`. Không để model tự nhớ toàn bộ lịch sử rồi tự suy luận trường nào thiếu — dễ quên/nhầm khi hội thoại dài.

```json
{
  "purpose": null,           // "o" | "kinh_doanh"
  "business_type": null,     // vd "spa", "cafe" — nguyên văn hoặc gần nguyên văn khách nói
  "business_category": null, // chuẩn hoá theo 2_knowledge_mapping.json, vd "beauty", "f_and_b"
  "area": null,               // khu vực, luôn ghi đè bằng giá trị mới nhất
  "size": null,                // chuẩn hoá về "100m2" hoặc "5x20"
  "structure": null,           // "tret_2_lau", "co_lung"...
  "bedroom": null,
  "wc": null,
  "budget": null,              // chuẩn hoá về đơn vị triệu/tháng
  "contact": null,             // SĐT hoặc Zalo, ghi đè nếu có giá trị mới
  "contact_type": null,        // "phone" | "zalo"
  "urgent": false,             // true nếu khách có nhắc cần gấp
  "pain_point": null,          // vấn đề khách chủ động nói ra, gần nguyên văn — vd "đã tìm nhiều nơi chưa ưng"
  "objection": null,           // lo ngại khách nói rõ — vd "sợ giá cao"
  "unclear_fields": [],        // các trường khách trả lời mơ hồ/né tránh, để hỏi lại cuối
  "ask_count": {},              // đếm số lần đã hỏi mỗi trường theo từng kiểu câu, dùng cho anti-loop
  "notes": null                 // thông tin phụ khách chủ động cung cấp (mặt tiền, số người ở...)
}
```

## Lưu ý quan trọng

**`pain_point` / `objection`**: chỉ ghi khi khách nói RÕ RÀNG, gần nguyên văn ý khách (vd khách tự nói "sợ giá mắc quá" → objection = "sợ giá cao"). **Không tự suy diễn hoặc gắn nhãn cảm xúc chủ quan** (vd không tự phán đoán "khách đang lo lắng/sốt ruột" nếu khách không nói ra điều đó) — dễ đoán sai và không nên dùng để quyết định cách đối xử với khách. Cân nhắc bỏ hẳn 1 field "emotion" mang tính suy diễn nếu có ý định thêm.

**Quy tắc cập nhật:**
- Mỗi lượt chat, merge thông tin mới vào state — trường nào có giá trị mới thì ghi đè, không cộng dồn.
- Chỉ hỏi trường `null` đầu tiên theo đúng thứ tự ưu tiên (Bước 1 trong `1_system_prompt_core.md`).
- Nếu `contact` đã có giá trị (kể cả cung cấp sớm ngoài dự kiến) → set cờ hoàn thành, bỏ qua bước xin liên hệ.

**Progress/completion (% số trường đã điền)**: chỉ dùng để dev debug/log nội bộ, **KHÔNG BAO GIỜ hiển thị con số này cho khách** (vd không được để model nói "hiện đã đủ 85% thông tin") — sẽ lộ ngay là chatbot.
