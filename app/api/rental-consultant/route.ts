import { NextRequest, NextResponse } from "next/server";
import {
  generateRentalConsultantReply,
  type RentalConsultationState,
} from "@/lib/rentalConsultation";
import { generateNaturalReply } from "@/src/services/naturalReply";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const payload = body as {
      message?: unknown;
      state?: Partial<RentalConsultationState> | null;
    };
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";
    const state = payload.state ?? undefined;

    if (!message) {
      return NextResponse.json(
        { error: "Thiếu nội dung tin nhắn." },
        { status: 400 }
      );
    }

    const result = generateRentalConsultantReply(message, state);
    const reply = await generateNaturalReply({
      message,
      state: result.state,
      nextMissingField: result.next_missing_field,
      leadQuality: result.lead_quality,
      shouldHandoff: result.should_handoff,
      deterministicReply: result.reply,
    });

    return NextResponse.json({
      ...result,
      reply,
    });
  } catch (error) {
    console.error("Rental consultant API error:", error);

    return NextResponse.json(
      { error: "Không xử lý được yêu cầu." },
      { status: 500 }
    );
  }
}

