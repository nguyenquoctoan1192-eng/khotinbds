import { NextResponse } from "next/server";
import {
  generateListingContentFallback,
  type ListingContentInput,
} from "@/lib/listingContent";
import { authorizeRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req, ["admin"]);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Chỉ Admin được tạo nội dung tin." }, { status: 403 });
    }

    const input = (await req.json()) as ListingContentInput;

    return NextResponse.json({
      success: true,
      content: generateListingContentFallback(input),
      source: "template",
    });
  } catch (error) {
    console.error("Listing content generation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Không tạo được nội dung AI.",
      },
      { status: 500 }
    );
  }
}

