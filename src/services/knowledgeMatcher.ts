import fs from "node:fs";
import path from "node:path";
import type { BusinessCategory } from "../types/state.ts";
import { hasKeyword } from "./text.ts";

type KnowledgeEntry = {
  businessCategory: BusinessCategory;
  businessTypeLabel: string;
  keywords: string[];
  sellingPoints: string[];
};

type KnowledgeFileEntry = {
  keywords?: unknown;
  business_type_label?: unknown;
  business_category?: unknown;
  selling_points?: unknown;
};

type KnowledgeFile = {
  industries?: unknown;
};

const businessCategories = new Set<BusinessCategory>([
  "beauty",
  "f_and_b",
  "retail",
  "office",
  "warehouse",
  "clinic",
  "khac",
]);

let cachedKnowledge: KnowledgeEntry[] | null = null;

function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === "string" && businessCategories.has(value as BusinessCategory);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function formatKnowledgeError(
  knowledgePath: string,
  error: unknown
): Error {
  const cause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new Error(`Failed to read knowledge mapping file at ${knowledgePath}. Cause: ${cause}`);
}

function parseKnowledgeFile(raw: string, knowledgePath: string): KnowledgeEntry[] {
  const parsed = JSON.parse(raw) as KnowledgeFile;

  if (!Array.isArray(parsed.industries)) {
    throw new Error(`Knowledge mapping file at ${knowledgePath} must contain an industries array.`);
  }

  return parsed.industries.map((rawEntry, index) => {
    const entry = rawEntry as KnowledgeFileEntry;

    if (
      !entry ||
      typeof entry !== "object" ||
      !isStringArray(entry.keywords) ||
      typeof entry.business_type_label !== "string" ||
      !isBusinessCategory(entry.business_category) ||
      !isStringArray(entry.selling_points)
    ) {
      throw new Error(
        `Invalid industry entry at prompts/2_knowledge_mapping.json industries[${index}].`
      );
    }

    return {
      businessCategory: entry.business_category,
      businessTypeLabel: entry.business_type_label,
      keywords: entry.keywords,
      sellingPoints: entry.selling_points,
    };
  });
}

function readKnowledgeOnce(): KnowledgeEntry[] {
  if (cachedKnowledge !== null) return cachedKnowledge;

  const knowledgePath = path.join(process.cwd(), "prompts", "2_knowledge_mapping.json");

  try {
    cachedKnowledge = parseKnowledgeFile(
      fs.readFileSync(knowledgePath, "utf8"),
      knowledgePath
    );
  } catch (error) {
    const formattedError = formatKnowledgeError(knowledgePath, error);
    console.error("[critical] knowledgeMatcher failed to load knowledge mapping", {
      knowledgePath,
      error,
    });
    throw formattedError;
  }

  return cachedKnowledge;
}

export function matchIndustry(
  businessType: string | null
): { businessCategory: BusinessCategory; sellingPoints: string[] } | null {
  if (!businessType) return null;

  const match = readKnowledgeOnce().find((entry) =>
    entry.keywords.some((keyword) => hasKeyword(businessType, keyword))
  );

  if (!match) return null;

  return {
    businessCategory: match.businessCategory,
    sellingPoints: match.sellingPoints,
  };
}

export function getKnownBusinessKeywords() {
  return readKnowledgeOnce().flatMap((entry) =>
    entry.keywords.map((keyword) => ({
      keyword,
      businessCategory: entry.businessCategory,
    }))
  );
}
