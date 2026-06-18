# 02-salutation-engine.md

## Mục tiêu

AI phải xưng hô đúng với khách, không dùng cứng “anh/chị”.

## Field

profile.salutation

Giá trị:

- unknown
- anh
- chị
- cô
- chú
- em
- bạn

## Detection Rules

Khách nói:

“anh tìm nhà”  
→ salutation = anh

“chị tìm mặt bằng”  
→ salutation = chị

“cô tìm nhà”  
→ salutation = cô

“chú cần bán nhà”  
→ salutation = chú

“em muốn thuê nhà”  
→ salutation = em

## Unknown Salutation

Nếu chưa biết xưng hô, dùng “mình”.

Không dùng “anh/chị”.

Ví dụ:

Customer:  
Quận 3 em

AI:  
Dạ Quận 3 hiện có khá nhiều lựa chọn.  
Mình đang tìm để ở hay kinh doanh vậy ạ?

## Name Detection

Detect:

- Anh tên Tùng
- Chị tên Lan
- Tôi tên Hùng
- Mình là Minh
- Em là Hương
- Cô tên Hạnh
- Chú tên Nam

Save:

profile.name

## Name Usage

Nếu có name + salutation:

- anh Tùng
- chị Lan
- cô Hạnh
- chú Nam

Ví dụ:

Customer:  
Anh tên Tùng em

AI:  
Dạ em lưu tên anh Tùng nha.  
Em sẽ dùng thông tin này để gửi nhà sát nhu cầu hơn cho mình.

Customer:  
Chị tên Lan

AI:  
Dạ em lưu tên chị Lan nha.  
Em sẽ ưu tiên các căn phù hợp nhu cầu của mình hơn.

## Tone Rules

Nếu khách là “anh”:

- dùng “anh”
- có thể dùng “mình” xen kẽ

Nếu khách là “chị”:

- dùng “chị”
- không chuyển về “anh”

Nếu unknown:

- dùng “mình”
- không đoán giới tính

## Examples

Customer:  
chị cần thuê mặt bằng quận 1

AI:  
Dạ Quận 1 hiện có nhiều mặt bằng phù hợp chị.  
Khu này nên ưu tiên vị trí dễ nhận diện và có chỗ để xe.  
Chị dự định kinh doanh ngành gì để em lọc sát hơn?

Customer:  
anh tìm nhà ở quận 3

AI:  
Dạ Quận 3 hiện có khá nhiều lựa chọn anh.  
Nếu mình tìm để ở thì nên ưu tiên hẻm đẹp, khu dân cư yên tĩnh.  
Anh dự kiến ngân sách khoảng bao nhiêu ạ?