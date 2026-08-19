import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/services/supabaseServer";

import { parseVietnameseRequirement } from "@/lib/requirementParser";

import {
  compareMatchResults,
  scoreListingForLead,
  type LeadRequirement,
  type MatchResult,
} from "@/lib/matching";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LeadRow = {
  id: string;
  fullname: string | null;
  phone: string | null;
  zalo?: string | null;
  facebook?: string | null;

  preferred_districts?: unknown;

  min_price?: number | string | null;
  max_price?: number | string | null;
  target_price?: number | string | null;

  min_area?: number | string | null;
  max_area?: number | string | null;
  target_area?: number | string | null;

  bedrooms?: number | string | null;
  min_bedrooms?: number | string | null;
  max_bedrooms?: number | string | null;

  property_type?: string | null;
  property_types?: unknown;

  status: string | null;
  note: string | null;

  created_at: string | null;
  updated_at?: string | null;

  lead_score?: number | null;
  lead_temperature?: string | null;
};

type LeadActivity = {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_at: string | null;
};

type ParsedRequirementWithPropertyType = {
  propertyType?: string | null;

  preferred_districts?: unknown;
  propertyTypes?: unknown;

  min_price?: number | string | null;
  max_price?: number | string | null;
  target_price?: number | string | null;

  min_area?: number | string | null;
  max_area?: number | string | null;
  target_area?: number | string | null;

  bedrooms?: number | string | null;
  min_bedrooms?: number | string | null;
  max_bedrooms?: number | string | null;
};

const normalizeList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,/|\n]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const getListingText = (
  listing: Record<string, unknown>
) => {
  return normalizeText(
    [
      listing.title,
      listing.address,
      listing.street,
      listing.district,
      listing.description,
      listing.note,
      listing.location,
      listing.content,
    ]
      .filter(Boolean)
      .join(" ")
  );
};

function buildRequirementFromLead(
  lead: LeadRow
): LeadRequirement {
  const rawText = String(lead.note || "").trim();

  const parsed =
    parseVietnameseRequirement(
      rawText
    ) as ParsedRequirementWithPropertyType;

  const dbDistricts = normalizeList(
    lead.preferred_districts
  );

  const parsedDistricts = normalizeList(
    parsed.preferred_districts
  );

  const preferredDistricts =
    dbDistricts.length > 0
      ? dbDistricts
      : parsedDistricts;

  const dbPropertyTypes = normalizeList(
    lead.property_types
  );

  const parsedPropertyTypes = normalizeList(
    parsed.propertyTypes
  );

  const propertyTypes =
    dbPropertyTypes.length > 0
      ? dbPropertyTypes
      : parsedPropertyTypes;

  return {
    ...parsed,

    rawText,

    preferred_districts:
      preferredDistricts,

    preferredDistricts,

    min_price:
      lead.min_price ??
      parsed.min_price ??
      null,

    max_price:
      lead.max_price ??
      parsed.max_price ??
      null,

    target_price:
      lead.target_price ??
      parsed.target_price ??
      null,

    min_area:
      lead.min_area ??
      parsed.min_area ??
      null,

    max_area:
      lead.max_area ??
      parsed.max_area ??
      null,

    target_area:
      lead.target_area ??
      parsed.target_area ??
      null,

    bedrooms:
      lead.bedrooms ??
      parsed.bedrooms ??
      null,

    min_bedrooms:
      lead.min_bedrooms ??
      parsed.min_bedrooms ??
      null,

    max_bedrooms:
      lead.max_bedrooms ??
      parsed.max_bedrooms ??
      null,

    property_type:
      lead.property_type ??
      parsed.propertyType ??
      null,

    property_types:
      propertyTypes,

    propertyTypes,
  } as LeadRequirement;
}

async function getLead(
  id: string,
  supabase: ReturnType<
    typeof createSupabaseServiceClient
  >
) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as LeadRow | null;
}

async function getLeadActivities(
  id: string,
  supabase: ReturnType<
    typeof createSupabaseServiceClient
  >
) {
  const { data, error } = await supabase
    .from("lead_activities")
    .select(
      "id, lead_id, type, content, created_at"
    )
    .eq("lead_id", id)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "GET /api/leads/[id] activities:",
      error
    );

    return [];
  }

  return (data || []) as LeadActivity[];
}

function listingMatchesDistrict(
  listing: Record<string, unknown>,
  districts: string[]
) {
  if (districts.length === 0) {
    return true;
  }

  const listingDistrict = normalizeText(
    [
      listing.district,
      listing.location,
      listing.address,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!listingDistrict) {
    return false;
  }

  return districts.some((district) => {
    const target = normalizeText(district);

    if (!target) {
      return false;
    }

    return (
      listingDistrict.includes(target) ||
      target.includes(listingDistrict)
    );
  });
}

function getRequestedStreets(
  requirement: LeadRequirement
): string[] {
  const raw =
    requirement as Record<string, unknown>;

  const values = [
    raw.priority_streets,
    raw.priorityStreets,
    raw.preferred_streets,
    raw.preferredStreets,
    raw.streets,
    raw.street,
    raw.street_name,
  ];

  for (const value of values) {
    const list = normalizeList(value);

    if (list.length > 0) {
      return list;
    }
  }

  return [];
}

function listingMatchesStreet(
  listing: Record<string, unknown>,
  streets: string[]
) {
  if (streets.length === 0) {
    return true;
  }

  const listingText =
    getListingText(listing);

  if (!listingText) {
    return false;
  }

  return streets.some((street) => {
    const normalizedStreet =
      normalizeText(street);

    return (
      normalizedStreet.length > 0 &&
      listingText.includes(normalizedStreet)
    );
  });
}

async function runMatching(
  lead: LeadRow,
  supabase: ReturnType<
    typeof createSupabaseServiceClient
  >
) {
  const requirement =
    buildRequirementFromLead(lead);

  const {
    data: listings,
    error: listingsError,
  } = await supabase
    .from("listings")
    .select("*");

  if (listingsError) {
    throw listingsError;
  }

  const candidates =
    (listings || []) as Record<
      string,
      unknown
    >[];

  const districts = normalizeList(
    (
      requirement as Record<
        string,
        unknown
      >
    ).preferred_districts
  );

  const requestedStreets =
    getRequestedStreets(requirement);

  let filteredCandidates = candidates;

  if (districts.length > 0) {
    const districtCandidates =
      candidates.filter((listing) =>
        listingMatchesDistrict(
          listing,
          districts
        )
      );

    if (districtCandidates.length > 0) {
      filteredCandidates =
        districtCandidates;
    }
  }

  if (requestedStreets.length > 0) {
    const streetCandidates =
      filteredCandidates.filter((listing) =>
        listingMatchesStreet(
          listing,
          requestedStreets
        )
      );

    if (streetCandidates.length > 0) {
      filteredCandidates =
        streetCandidates;
    }
  }

  const matches: MatchResult[] = [];

  for (const listing of filteredCandidates) {
    try {
      type MatchingListing =
        Parameters<
          typeof scoreListingForLead
        >[0];

      const match =
        scoreListingForLead(
          listing as MatchingListing,
          requirement
        );

      if (!match) {
        continue;
      }

      if (match.score < 40) {
        continue;
      }

      matches.push(match);
    } catch (error) {
      console.error(
        "Matching listing error:",
        listing.id,
        error
      );
    }
  }

  matches.sort(compareMatchResults);

  return {
    requirement,
    matches: matches.slice(0, 30),
  };
}

/* =========================================================
   GET CUSTOMER DETAIL
========================================================= */

export async function GET(
  _req: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const leadId =
      String(id || "").trim();

    if (!leadId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Thiếu ID khách hàng.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const supabase =
      createSupabaseServiceClient();

    const lead = await getLead(
      leadId,
      supabase
    );

    if (!lead) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Không tìm thấy khách hàng.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const rawNote =
      lead.note || "";

    const {
      requirement,
      matches,
    } = await runMatching(
      lead,
      supabase
    );

    const activities =
      await getLeadActivities(
        leadId,
        supabase
      );

    return NextResponse.json(
      {
        success: true,
        lead,
        rawNote,
        requirement,
        normalizedRequirement:
          requirement,
        matches,
        listings: matches,
        activities,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/leads/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Lỗi máy chủ.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}

/* =========================================================
   DELETE CUSTOMER
========================================================= */

export async function DELETE(
  _req: Request,
  context: RouteContext
) {
  const jsonHeaders = {
    "Cache-Control":
      "no-store, max-age=0",
  };

  try {
    const { id } = await context.params;

    const leadId =
      String(id || "").trim();

    if (!leadId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Thiếu ID khách hàng.",
        },
        {
          status: 400,
          headers: jsonHeaders,
        }
      );
    }

    const supabase =
      createSupabaseServiceClient();

    console.log(
      "[DELETE LEAD] START:",
      leadId
    );

    /* =====================================================
       1. KIỂM TRA KHÁCH TỒN TẠI
    ===================================================== */

    const {
      data: existingLead,
      error: findError,
    } = await supabase
      .from("leads")
      .select("id, fullname")
      .eq("id", leadId)
      .maybeSingle();

    if (findError) {
      console.error(
        "[DELETE LEAD] FIND ERROR:",
        findError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            findError.message ||
            "Không kiểm tra được khách hàng.",
          code:
            findError.code || null,
          details:
            findError.details || null,
          hint:
            findError.hint || null,
        },
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    }

    if (!existingLead) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Khách hàng không tồn tại hoặc đã được xóa.",
        },
        {
          status: 404,
          headers: jsonHeaders,
        }
      );
    }

    console.log(
      "[DELETE LEAD] FOUND:",
      existingLead.id,
      existingLead.fullname
    );

    /* =====================================================
       2. XÓA LEAD MATCHES
    ===================================================== */

    const {
      error: matchesError,
    } = await supabase
      .from("lead_matches")
      .delete()
      .eq("lead_id", leadId);

    if (matchesError) {
      /*
       * Không chặn nếu bảng này không tồn tại
       * hoặc không có dữ liệu.
       *
       * Tuy nhiên nếu database có FK bắt buộc
       * thì bước xóa leads bên dưới sẽ báo lỗi.
       */
      console.warn(
        "[DELETE LEAD] lead_matches warning:",
        matchesError.message
      );
    }

    /* =====================================================
       3. XÓA LỊCH SỬ TƯƠNG TÁC
    ===================================================== */

    const {
      error: activitiesError,
    } = await supabase
      .from("lead_activities")
      .delete()
      .eq("lead_id", leadId);

    if (activitiesError) {
      console.warn(
        "[DELETE LEAD] lead_activities warning:",
        activitiesError.message
      );
    }

    /* =====================================================
       4. XÓA KHÁCH THẬT KHỎI BẢNG leads
    ===================================================== */

    const {
      data: deletedLead,
      error: deleteError,
    } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error(
        "[DELETE LEAD] LEADS DELETE ERROR:",
        deleteError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            deleteError.message ||
            "Không thể xóa khách hàng khỏi database.",
          code:
            deleteError.code || null,
          details:
            deleteError.details || null,
          hint:
            deleteError.hint || null,
        },
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    }

    /* =====================================================
       5. BẮT BUỘC PHẢI CÓ RECORD ĐƯỢC XÓA
    ===================================================== */

    if (!deletedLead) {
      console.error(
        "[DELETE LEAD] NOTHING DELETED:",
        leadId
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Không có khách hàng nào được xóa.",
        },
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    }

    console.log(
      "[DELETE LEAD] DELETED:",
      deletedLead.id
    );

    /* =====================================================
       6. KIỂM TRA LẠI DATABASE
    ===================================================== */

    const {
      data: remainingLead,
      error: verifyError,
    } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .maybeSingle();

    if (verifyError) {
      console.error(
        "[DELETE LEAD] VERIFY ERROR:",
        verifyError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            verifyError.message ||
            "Không thể xác nhận việc xóa.",
          code:
            verifyError.code || null,
          details:
            verifyError.details || null,
          hint:
            verifyError.hint || null,
        },
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    }

    /* =====================================================
       7. NẾU VẪN CÒN -> KHÔNG BAO GIỜ TRẢ SUCCESS
    ===================================================== */

    if (remainingLead) {
      console.error(
        "[DELETE LEAD] RECORD STILL EXISTS:",
        leadId
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Đã gửi lệnh xóa nhưng khách hàng vẫn còn trong database.",
          deleted_id: leadId,
        },
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    }

    /* =====================================================
       8. XÓA THÀNH CÔNG
    ===================================================== */

    console.log(
      "[DELETE LEAD] SUCCESS:",
      leadId
    );

    return NextResponse.json(
      {
        success: true,
        deleted: true,
        deleted_id: leadId,
        message:
          "Đã xóa khách hàng khỏi CRM.",
      },
      {
        status: 200,
        headers: jsonHeaders,
      }
    );
  } catch (error) {
    console.error(
      "[DELETE LEAD] UNHANDLED ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể xóa khách hàng.",
      },
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }
}