export type LeadTemperature = "Hot" | "Warm" | "Cold";

export type SalesAgent = {
  id: string;
  name: string;
  districts: string[];
  hotLeadSpecialist?: boolean;
};

export type LeadAssignmentLead = {
  id?: unknown;
  preferred_districts?: unknown;
  lead_temperature?: unknown;
  lead_score?: unknown;
};

export type LeadAssignmentResult = {
  assigned_to: string;
  assignment_reason: string;
};

export const DEFAULT_SALES_TEAM: SalesAgent[] = [
  {
    id: "sale-central",
    name: "Sale Trung tâm",
    districts: ["Quận 1", "Quận 3", "Quận 5", "Quận 10"],
    hotLeadSpecialist: true,
  },
  {
    id: "sale-north",
    name: "Sale Bình Thạnh - Gò Vấp",
    districts: ["Bình Thạnh", "Gò Vấp", "Phú Nhuận"],
  },
  {
    id: "sale-west",
    name: "Sale Tân Bình - Tân Phú",
    districts: ["Tân Bình", "Tân Phú", "Quận 11"],
  },
  {
    id: "sale-east",
    name: "Sale Thủ Đức - Quận 2",
    districts: ["Thủ Đức", "Quận 2", "Quận 7"],
  },
];

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const formatDistricts = (districts: unknown) => {
  if (Array.isArray(districts)) {
    return districts.filter(Boolean).map(String).join(", ");
  }

  if (typeof districts === "string") {
    return districts;
  }

  if (districts && typeof districts === "object") {
    return Object.values(districts)
      .filter(Boolean)
      .map(String)
      .join(", ");
  }

  return "";
};

const getTemperature = (lead: LeadAssignmentLead): LeadTemperature => {
  const normalized = normalizeText(lead.lead_temperature);

  if (normalized.includes("hot")) return "Hot";
  if (normalized.includes("warm")) return "Warm";
  if (normalized.includes("cold")) return "Cold";

  const score = Number(lead.lead_score || 0);

  if (Number.isFinite(score) && score >= 80) return "Hot";
  if (Number.isFinite(score) && score >= 50) return "Warm";

  return "Cold";
};

const hasDistrictMatch = (leadDistricts: string, agent: SalesAgent) => {
  const normalizedLeadDistricts = normalizeText(leadDistricts);

  return agent.districts.some((district) =>
    normalizedLeadDistricts.includes(normalizeText(district))
  );
};

const getAgentScore = (
  agent: SalesAgent,
  leadDistricts: string,
  temperature: LeadTemperature,
  workloads: Record<string, number>
) => {
  const districtScore = hasDistrictMatch(leadDistricts, agent) ? 100 : 0;
  const temperatureScore =
    temperature === "Hot" && agent.hotLeadSpecialist ? 15 : 0;
  const workloadPenalty = (workloads[agent.id] || 0) * 8;

  return districtScore + temperatureScore - workloadPenalty;
};

export const calculateLeadAssignment = ({
  lead,
  workloads = {},
  team = DEFAULT_SALES_TEAM,
}: {
  lead: LeadAssignmentLead;
  workloads?: Record<string, number>;
  team?: SalesAgent[];
}): LeadAssignmentResult => {
  const districts = formatDistricts(lead.preferred_districts);
  const temperature = getTemperature(lead);
  const availableTeam = team.length > 0 ? team : DEFAULT_SALES_TEAM;
  const selected = [...availableTeam].sort(
    (a, b) =>
      getAgentScore(b, districts, temperature, workloads) -
        getAgentScore(a, districts, temperature, workloads) ||
      (workloads[a.id] || 0) - (workloads[b.id] || 0)
  )[0];

  const workload = workloads[selected.id] || 0;
  const hasMatch = hasDistrictMatch(districts, selected);
  const reasonParts = [
    hasMatch
      ? `Phụ trách khu vực ${districts || selected.districts.join(", ")}`
      : "Chưa khớp khu vực rõ, phân theo tải công việc",
    `đang có ${workload} lead`,
    temperature === "Hot" && selected.hotLeadSpecialist
      ? "ưu tiên sale xử lý lead nóng"
      : `lead ${temperature}`,
  ];

  return {
    assigned_to: selected.name,
    assignment_reason: reasonParts.join("; "),
  };
};

export const buildLeadAssignments = (
  leads: LeadAssignmentLead[],
  team: SalesAgent[] = DEFAULT_SALES_TEAM
) => {
  const workloads = Object.fromEntries(team.map((agent) => [agent.id, 0]));
  const assignments: Record<string, LeadAssignmentResult> = {};
  const sortedLeads = [...leads].sort((a, b) => {
    const temperatureRank: Record<LeadTemperature, number> = {
      Hot: 0,
      Warm: 1,
      Cold: 2,
    };

    return temperatureRank[getTemperature(a)] - temperatureRank[getTemperature(b)];
  });

  for (const lead of sortedLeads) {
    const id = String(lead.id || "");
    if (!id) continue;

    const assignment = calculateLeadAssignment({ lead, workloads, team });
    const agent = team.find((item) => item.name === assignment.assigned_to);

    assignments[id] = assignment;

    if (agent) {
      workloads[agent.id] = (workloads[agent.id] || 0) + 1;
    }
  }

  return assignments;
};
