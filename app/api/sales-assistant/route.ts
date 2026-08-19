import { NextResponse } from "next/server";
import {
  generateContextualReply,
  type GenerateContextualReplyInput,
} from "@/lib/sales-playbook";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateContextualReplyInput;

    if (!body.customerMessage || typeof body.customerMessage !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Thiếu tin nhắn khách hàng.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(generateContextualReply(body));
  } catch (error) {
    console.error("Sales assistant failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Không tạo được gợi ý phản hồi.",
      },
      { status: 500 }
    );
  }
}

