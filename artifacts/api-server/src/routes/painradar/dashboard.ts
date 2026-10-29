import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  GetAnalyticsResponse,
  GetDashboardResponse,
} from "@workspace/api-zod";
import { campaignsTable, db, leadsTable } from "@workspace/db";
import {
  accountId,
  getOrCreateSettings,
  visibleLeads,
} from "../../lib/painradar-data";

const router: IRouter = Router();

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weeklyActivity(
  leads: (typeof leadsTable.$inferSelect)[],
): { day: string; leads: number; contacted: number }[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - (6 - index));
    const key = dateKey(day);
    return {
      day: key,
      leads: leads.filter((lead) => dateKey(lead.createdAt) === key).length,
      contacted: leads.filter(
        (lead) => lead.contactedAt && dateKey(lead.contactedAt) === key,
      ).length,
    };
  });
}

async function getVisibleAccountLeads(userId: string) {
  const [settings, rows] = await Promise.all([
    getOrCreateSettings(userId),
    db.select().from(leadsTable).where(eq(leadsTable.userId, userId)),
  ]);
  return visibleLeads(rows, settings);
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const userId = accountId(req);
  const [campaigns, leads] = await Promise.all([
    db.select().from(campaignsTable).where(eq(campaignsTable.userId, userId)),
    getVisibleAccountLeads(userId),
  ]);

  const recentLeads = [...leads]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 5);
  const summary = {
    campaigns: campaigns.length,
    totalLeads: leads.length,
    savedLeads: leads.filter((lead) => lead.saved).length,
    highIntentLeads: leads.filter(
      (lead) => lead.intentCategory !== "general_problem",
    ).length,
    contactedLeads: leads.filter((lead) =>
      ["contacted", "replied", "converted"].includes(lead.status),
    ).length,
    recentLeads,
    weeklyActivity: weeklyActivity(leads),
  };
  res.json(GetDashboardResponse.parse(summary));
});

router.get("/analytics", async (req, res): Promise<void> => {
  const leads = await getVisibleAccountLeads(accountId(req));
  const countBy = (field: "intentCategory" | "source") => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = lead[field];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const label = (value: string) => {
      if (value === "recommendation_request") return "Recommendation request";
      if (value === "solution_search") return "Active solution search";
      if (value === "general_problem") return "General problem";
      if (value === "hacker_news") return "Hacker News";
      if (value === "reddit") return "Reddit";
      if (value === "x") return "X";
      if (value === "facebook") return "Facebook";
      return "Other";
    };
    return [...counts.entries()].map(([value, count]) => ({
      label: label(value),
      count,
    }));
  };

  res.json(
    GetAnalyticsResponse.parse({
      totalLeads: leads.length,
      savedLeads: leads.filter((lead) => lead.saved).length,
      contactedLeads: leads.filter((lead) =>
        ["contacted", "replied", "converted"].includes(lead.status),
      ).length,
      repliedLeads: leads.filter((lead) => lead.status === "replied").length,
      convertedLeads: leads.filter((lead) => lead.status === "converted").length,
      byIntent: countBy("intentCategory"),
      bySource: countBy("source"),
      weeklyActivity: weeklyActivity(leads),
    }),
  );
});

export default router;
