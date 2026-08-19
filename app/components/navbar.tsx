export default function Navbar() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        <h1 className="text-2xl font-bold">
          BDS
        </h1>

        <nav className="flex items-center gap-6">

          <a className="font-medium cursor-pointer">
            Trang chủ
          </a>

          <a className="font-medium cursor-pointer">
            Nhà cho thuê
          </a>

          <a className="font-medium cursor-pointer">
            Mặt bằng
          </a>

          <button className="bg-black text-white px-5 py-2 rounded-xl">
            Đăng tin
          </button>

        </nav>

      </div>
    </header>
  )
}

