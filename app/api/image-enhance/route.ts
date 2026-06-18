import { NextResponse } from "next/server";

type ImageEnhanceOptions = {
  removeLogo?: boolean;
  removePhone?: boolean;
  removeAddress?: boolean;
  enhanceQuality?: boolean;
  removeObjects?: boolean;
};

type ImageEnhanceRequest = {
  imageUrl?: string;
  options?: ImageEnhanceOptions;
};

const notConfiguredMessage =
  "Chưa cấu hình AI xử lý ảnh. Vui lòng thêm OPENAI_API_KEY hoặc provider xử lý ảnh.";

const normalizeOptions = (options: ImageEnhanceOptions = {}) => ({
  removeLogo: Boolean(options.removeLogo),
  removePhone: Boolean(options.removePhone),
  removeAddress: Boolean(options.removeAddress),
  enhanceQuality: Boolean(options.enhanceQuality),
  removeObjects: Boolean(options.removeObjects),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ImageEnhanceRequest;
    const imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!imageUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Thiếu URL ảnh cần xử lý.",
        },
        { status: 400 }
      );
    }

    const options = normalizeOptions(body.options);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: notConfiguredMessage,
      });
    }

    console.info("Image enhance requested but provider is not implemented yet.", {
      imageUrl,
      options,
    });

    return NextResponse.json(
      {
        success: false,
        message:
          "Provider xử lý ảnh chưa được cấu hình. Vui lòng thêm workflow xử lý ảnh trước khi chạy AI sửa ảnh.",
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("Image enhance failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Không xử lý được ảnh. Vui lòng thử lại sau.",
      },
      { status: 500 }
    );
  }
}
