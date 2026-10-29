import type { Campaign } from "@workspace/db";

export type LeadIntent =
  | "recommendation_request"
  | "solution_search"
  | "general_problem";

export type LeadFlags = {
  isSpam: boolean;
  isSelfPromotion: boolean;
  isBait: boolean;
  isIrrelevant: boolean;
};

export type LeadScoringResult = {
  relevanceScore: number;
  intentCategory: LeadIntent;
  intentSignals: string[];
  scoreReasons: string[];
  flags: LeadFlags;
};

type ScoreInput = Pick<
  Campaign,
  "keywords" | "problems" | "excludedTopics" | "targetAudience"
>;

const recommendationPatterns = [
  /\b(?:any\s+(?:good\s+)?recommendations?|recommendations?\s+(?:for|on)|any\s+suggestions?|suggestions?\s+(?:for|on))\b/i,
  /\bwhat\s+(?:tools?|apps?|software)\s+(?:do|would)\s+you\s+(?:use|recommend)\b/i,
  /\b(?:which|what(?:'s|\s+is)\s+the\s+best)\s+(?:tool|app|software|service)\b/i,
  /\balternatives?\s+to\b/i,
  /\bwhat\s+do\s+you\s+use\s+for\b/i,
];

const solutionSearchPatterns = [
  /\b(?:looking|searching|trying)\s+for\b/i,
  /\bneed\s+(?:a|an|some)\s+(?:tool|app|software|solution|service|way)\b/i,
  /\bhow\s+(?:can|do)\s+i\b/i,
  /\bis\s+there\s+(?:a|any)\s+(?:tool|app|software|solution|service)\b/i,
  /\banyone\s+know\s+(?:a|of)\s+(?:good\s+)?(?:tool|app|software|solution)\b/i,
];

const spamPattern =
  /\b(?:free money|guaranteed (?:profit|income|returns)|crypto airdrop|click here now|earn \d+%|double your money)\b/i;
const selfPromotionPattern =
  /\b(?:show hn|i built|i created|we launched|launching my|my new app|check out my|try my product|my startup)\b/i;
const baitPattern =
  /\b(?:you won't believe|shocking secret|secret no one knows|must see before)\b/i;

function termMatches(content: string, rawTerm: string): boolean {
  const term = rawTerm.trim().toLocaleLowerCase();
  if (term.length < 2) return false;
  if (term.length <= 3) {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}([^\\p{L}\\p{N}]|$)`, "iu").test(content);
  }
  return content.includes(term);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueTerms(terms: string[]): string[] {
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
}

function findIntent(text: string): {
  category: LeadIntent;
  signal: string;
} {
  for (const pattern of recommendationPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        category: "recommendation_request",
        signal: `Explicit recommendation language: “${match[0]}”`,
      };
    }
  }
  for (const pattern of solutionSearchPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        category: "solution_search",
        signal: `Active search language: “${match[0]}”`,
      };
    }
  }
  return {
    category: "general_problem",
    signal: "Problem discussion only; no explicit solution request detected.",
  };
}

function recencyPoints(discussionAt: Date | null, now: Date): {
  points: number;
  label: string;
} {
  if (!discussionAt) {
    return { points: 0, label: "Discussion date unavailable; freshness not scored" };
  }
  const ageDays = Math.max(
    0,
    (now.getTime() - discussionAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (ageDays <= 1) return { points: 15, label: "Posted within 24 hours" };
  if (ageDays <= 7) return { points: 11, label: "Posted within 7 days" };
  if (ageDays <= 30) return { points: 6, label: "Posted within 30 days" };
  return { points: 2, label: "Older discussion" };
}

export function scoreLead(
  campaign: ScoreInput,
  title: string,
  excerpt: string,
  discussionAt: Date | null,
  engagementCount: number | null,
  now = new Date(),
): LeadScoringResult {
  const content = `${title}\n${excerpt}`.toLocaleLowerCase();
  const keywordMatches = uniqueTerms(campaign.keywords).filter((term) =>
    termMatches(content, term),
  );
  const problemMatches = uniqueTerms(campaign.problems).filter((term) =>
    termMatches(content, term),
  );
  const excludedMatch = uniqueTerms(campaign.excludedTopics).find((term) =>
    termMatches(content, term),
  );
  const audienceMatch = uniqueTerms(campaign.targetAudience.split(/[,;|]/)).find(
    (term) => term.length > 2 && termMatches(content, term),
  );
  const intent = findIntent(`${title}\n${excerpt}`);

  const flags: LeadFlags = {
    isSpam: spamPattern.test(content),
    isSelfPromotion: selfPromotionPattern.test(content),
    isBait: baitPattern.test(content),
    isIrrelevant:
      Boolean(excludedMatch) ||
      (keywordMatches.length === 0 && problemMatches.length === 0),
  };

  const reasons: string[] = [];
  let score = 0;
  if (keywordMatches.length > 0) {
    score += Math.min(42, keywordMatches.length * 16);
    reasons.push(
      `Matches campaign keyword${keywordMatches.length > 1 ? "s" : ""}: ${keywordMatches.slice(0, 3).join(", ")}`,
    );
  }
  if (problemMatches.length > 0) {
    score += Math.min(24, problemMatches.length * 12);
    reasons.push(
      `Matches problem${problemMatches.length > 1 ? "s" : ""} you solve: ${problemMatches.slice(0, 2).join(", ")}`,
    );
  }
  if (audienceMatch) {
    score += 4;
    reasons.push(`Audience context matches: ${audienceMatch}`);
  }

  const intentPoints =
    intent.category === "recommendation_request"
      ? 10
      : intent.category === "solution_search"
        ? 7
        : 3;
  score += intentPoints;
  reasons.push(intent.signal);

  const freshness = recencyPoints(discussionAt, now);
  score += freshness.points;
  reasons.push(freshness.label);

  if (engagementCount !== null) {
    const points = Math.min(10, Math.round(Math.log2(engagementCount + 1) * 2));
    score += points;
    reasons.push(
      `Available engagement: ${engagementCount.toLocaleString()} ${engagementCount === 1 ? "interaction" : "interactions"}`,
    );
  } else {
    reasons.push("Engagement is not available from this source");
  }

  if (excludedMatch) {
    score -= 25;
    reasons.push(`Excluded topic detected: ${excludedMatch}`);
  }
  if (flags.isSpam) {
    score -= 25;
    reasons.push("Potential spam language detected");
  }
  if (flags.isSelfPromotion) {
    score -= 18;
    reasons.push("Possible self-promotion detected");
  }
  if (flags.isBait) {
    score -= 15;
    reasons.push("Possible engagement bait detected");
  }
  if (flags.isIrrelevant && !excludedMatch) {
    score -= 18;
    reasons.push("No campaign keyword or problem match found");
  }

  return {
    relevanceScore: Math.max(0, Math.min(100, Math.round(score))),
    intentCategory: intent.category,
    intentSignals: [intent.signal],
    scoreReasons: reasons,
    flags,
  };
}
