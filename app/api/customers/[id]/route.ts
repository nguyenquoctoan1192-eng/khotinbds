import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { getCustomerDetail } from "@/lib/services/customerService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getAccess(req, ["admin", "agent"]);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { customer, conversations, error } = await getCustomerDetail(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    customer,
    conversations,
  });
}