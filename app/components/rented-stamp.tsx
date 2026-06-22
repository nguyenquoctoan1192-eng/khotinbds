export default function RentedStamp() {
  return (
    <div
      aria-label="Đã cho thuê"
      style={{
        width: 120,
        height: 120,
        borderRadius: 9999,
        background: "#dc2626",
        color: "white",
        fontWeight: 800,
        fontSize: 20,
        lineHeight: 1.1,
        textAlign: "center",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        opacity: 0.95,
        border: "4px solid white",
        boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <span>ĐÃ</span>
      <span>CHO</span>
      <span>THUÊ</span>
    </div>
  );
}
