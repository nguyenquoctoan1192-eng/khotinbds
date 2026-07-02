// app/api/rental-consultant/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  generateRentalConsultantReply,
  type RentalConsultationState,
} from "@/lib/rentalConsultation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const state = body?.state as Partial<RentalConsultationState> | undefined;

    if (!message) {
      return NextResponse.json(
        { error: "Thiếu nội dung tin nhắn." },
        { status: 400 }
      );
    }

    const result = generateRentalConsultantReply(message, state);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Rental consultant API error:", error);

    return NextResponse.json(
      { error: "Không xử lý được yêu cầu." },
      { status: 500 }
    );
  }
}