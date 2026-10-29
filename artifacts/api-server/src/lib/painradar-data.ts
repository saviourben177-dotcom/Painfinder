import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  campaignsTable,
  db,
  leadsTable,
  userSettingsTable,
  type Campaign,
  type Lead,
  type UserSettings,
} from "@workspace/db";
import {
  GetLeadResponse,
  GetSettingsResponse,
  ListCampaignsResponseItem,
  ListLeadsResponseItem,
} from "@workspace/api-zod";

export function accountId(req: Request): string {
  if (!req.userId) {
    throw new Error("Authenticated route was reached without a user ID");
  }
  return req.userId;
}

export function campaignResponse(campaign: Campaign) {
  return ListCampaignsResponseItem.parse(campaign);
}

export function leadResponse(lead: Lead) {
  return GetLeadResponse.parse(lead);
}

export function leadListResponse(lead: Lead) {
  return ListLeadsResponseItem.parse(lead);
}

export async function getOrCreateSettings(userId: string): Promise<UserSettings> {
  const [current] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId))
    .limit(1);
  if (current) return current;

  const [created] = await db
    .insert(userSettingsTable)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [afterConflict] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId))
    .limit(1);
  if (!afterConflict) {
    throw new Error("Could not create account settings");
  }
  return afterConflict;
}

export function visibleLeads(leads: Lead[], settings: UserSettings): Lead[] {
  return leads.filter((lead) => {
    if (!settings.showDemoData && lead.isDemo) return false;
    if (
      settings.hideFlagged &&
      (lead.isSpam || lead.isSelfPromotion || lead.isBait || lead.isIrrelevant)
    ) {
      return false;
    }
    return lead.relevanceScore >= settings.minimumRelevance;
  });
}

export function normalizeDiscussionUrl(rawUrl: string): {
  url: string;
  source: "reddit" | "hacker_news" | "x" | "facebook" | "other";
} {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS discussion links are supported");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Discussion links cannot include embedded credentials");
  }

  parsed.hash = "";
  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of [...parsed.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      ["fbclid", "gclid", "ref", "source"].includes(key.toLowerCase())
    ) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();
  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  const host = parsed.hostname;
  let source: "reddit" | "hacker_news" | "x" | "facebook" | "other" = "other";
  if (host === "reddit.com" || host.endsWith(".reddit.com")) {
    source = "reddit";
  } else if (
    host === "news.ycombinator.com" ||
    host === "hacker-news.firebaseio.com"
  ) {
    source = "hacker_news";
  } else if (
    host === "x.com" ||
    host.endsWith(".x.com") ||
    host === "twitter.com" ||
    host.endsWith(".twitter.com")
  ) {
    source = "x";
  } else if (host === "facebook.com" || host.endsWith(".facebook.com")) {
    source = "facebook";
  }

  return { url: parsed.toString(), source };
}

export function settingsResponse(settings: UserSettings) {
  return GetSettingsResponse.parse(settings);
}

export async function findOwnedCampaign(
  userId: string,
  campaignId: string,
): Promise<Campaign | undefined> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.userId, userId),
        eq(campaignsTable.id, campaignId),
      ),
    )
    .limit(1);
  return campaign;
}

export async function findOwnedLead(
  userId: string,
  leadId: string,
): Promise<Lead | undefined> {
  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(and(eq(leadsTable.userId, userId), eq(leadsTable.id, leadId)))
    .limit(1);
  return lead;
}
