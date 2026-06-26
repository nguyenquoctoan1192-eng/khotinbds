import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { getCustomers } from "@/lib/services/customerService";

export async function GET(req: Request) {
  const access = await getAccess(req, ["admin", "agent"]);

  if (!access) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await getCustomers();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}