export function calculateLeadScore(
  events: any[] = [],
  customer: any = {}
) {
  let score = 0;

  if (customer.source === "website") score += 10;

  if (customer.source === "facebook") score += 20;

  if (customer.source === "zalo") score += 25;

  for (const event of events) {
    score += event.score || 0;
  }

  if (score > 100) score = 100;

  return score;
}