"use client";

const benefits = [
  {
    icon: "T",
    title: "Thông tin thật",
    text: "Cam kết tin đăng chính xác",
  },
  {
    icon: "$",
    title: "Giá tốt mỗi ngày",
    text: "Cập nhật giá thuê mới nhất",
  },
  {
    icon: "F",
    title: "Tìm nhà nhanh",
    text: "Bộ lọc thông minh, chính xác",
  },
  {
    icon: "24",
    title: "Hỗ trợ tận tâm",
    text: "Tư vấn 24/7, nhiệt tình",
  },
  {
    icon: "+",
    title: "Ký gửi miễn phí",
    text: "Đăng tin cho thuê nhanh chóng",
  },
];

export default function HomeBenefits() {
  return (
    <section className="home-benefits">
      {benefits.map((benefit) => (
        <article key={benefit.title}>
          <span>{benefit.icon}</span>
          <strong>{benefit.title}</strong>
          <p>{benefit.text}</p>
        </article>
      ))}
    </section>
  );
}

