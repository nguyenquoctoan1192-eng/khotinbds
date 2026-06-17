import { NextResponse } from "next/server";
import {
  buildListingContentPrompt,
  generateListingContentFallback,
  sanitizeListingContent,
  type ListingContentInput,
} from "@/lib/listingContent";

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as ListingContentInput;
    const fallback = generateListingContentFallback(input);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        content: fallback,
        source: "fallback",
      });
    }

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: buildListingContentPrompt(input),
        text: {
          format: {
            type: "json_schema",
            name: "listing_content_result",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                listing_title: { type: "string" },
                short_description: { type: "string" },
                facebook_post: { type: "string" },
                seo_description: { type: "string" },
              },
              required: [
                "listing_title",
                "short_description",
                "facebook_post",
                "seo_description",
              ],
            },
          },
        },
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("Listing content OpenAI error:", json);
      return NextResponse.json({
        success: true,
        content: fallback,
        source: "fallback",
      });
    }

    const outputText =
      json.output_text ||
      json.output
        ?.flatMap((item: any) => item.content || [])
        ?.find((content: any) => content.type === "output_text")?.text ||
      "";
    const parsed = JSON.parse(outputText);

    return NextResponse.json({
      success: true,
      content: sanitizeListingContent(parsed, input),
      source: "openai",
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
