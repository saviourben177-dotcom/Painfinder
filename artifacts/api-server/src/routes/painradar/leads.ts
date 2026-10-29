import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  DeleteLeadParams,
  DiscoverHackerNewsBody,
  DiscoverHackerNewsResponse,
  GetLeadParams,
  ImportLeadBody,
  ImportLeadResponse,
  ListLeadsQueryParams,
  ListLeadsResponse,
  UpdateLeadBody,
  UpdateLeadParams,
  UpdateLeadResponse,
} from "@workspace/api-zod";
import { db, leadsTable } from "@workspace/db";
import { hackerNewsConnector } from "../../connectors/hacker-news";
import { scoreLead } from "../../lib/painradar-scoring";
import {
  accountId,
  findOwnedCampaign,
  findOwnedLead,
  getOrCreateSettings,
  leadListResponse,
  leadResponse,
  normalizeDiscussionUrl,
  visibleLeads,
} from "../../lib/painradar-data";

const router: IRouter = Router();

router.get("/leads", async (req, res): Promise<void> => {
  const queryInput = {
    ...req.query,
    savedOnly:
      req.query.savedOnly === "true"
        ? true
        : req.query.savedOnly === "false"
          ? false
          : req.query.savedOnly,
  };
  const parsed = ListLeadsQueryParams.safeParse(queryInput);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = accountId(req);
  const settings = await getOrCreateSettings(userId);
  const rows = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.userId, userId));

  const q = parsed.data.q?.trim().toLocaleLowerCase();
  const cutoff =
    parsed.data.recency && parsed.data.recency !== "all"
      ? new Date(
          Date.now() -
            Number.parseInt(parsed.data.recency, 10) * 24 * 60 * 60 * 1000,
        )
      : undefined;

  let filtered = visibleLeads(rows, settings).filter((lead) => {
    if (parsed.data.campaignId && lead.campaignId !== parsed.data.campaignId) {
      return false;
    }
    if (parsed.data.source && lead.source !== parsed.data.source) return false;
    if (
      parsed.data.intent &&
      lead.intentCategory !== parsed.data.intent
    ) {
      return false;
    }
    if (parsed.data.status && lead.status !== parsed.data.status) return false;
    if (parsed.data.savedOnly && !lead.saved) return false;
    if (
      parsed.data.minScore !== undefined &&
      lead.relevanceScore < parsed.data.minScore
    ) {
      return false;
    }
    if (
      parsed.data.minEngagement !== undefined &&
      (lead.engagementCount === null ||
        lead.engagementCount < parsed.data.minEngagement)
    ) {
      return false;
    }
    if (cutoff && (!lead.discussionAt || lead.discussionAt < cutoff)) {
      return false;
    }
    if (
      q &&
      !`${lead.title}\n${lead.excerpt}`.toLocaleLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  if (parsed.data.sort === "recent") {
    filtered = filtered.sort(
      (left, right) =>
        (right.discussionAt?.getTime() ?? 0) -
        (left.discussionAt?.getTime() ?? 0),
    );
  } else if (parsed.data.sort === "engagement") {
    filtered = filtered.sort(
      (left, right) =>
        (right.engagementCount ?? -1) - (left.engagementCount ?? -1),
    );
  } else {
    filtered = filtered.sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore ||
        (right.discussionAt?.getTime() ?? 0) -
        (left.discussionAt?.getTime() ?? 0),
    );
  }

  res.json(ListLeadsResponse.parse(filtered.map(leadListResponse)));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = ImportLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = accountId(req);
  const campaign = await findOwnedCampaign(userId, parsed.data.campaignId);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }

  let normalized: ReturnType<typeof normalizeDiscussionUrl>;
  try {
    normalized = normalizeDiscussionUrl(parsed.data.sourceUrl);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Enter a valid public HTTP or HTTPS discussion URL.",
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(leadsTable)
    .where(
      and(
        eq(leadsTable.userId, userId),
        eq(leadsTable.sourceUrl, normalized.url),
      ),
    )
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "This discussion is already in your leads." });
    return;
  }

  const discussionAt = parsed.data.discussionAt ?? null;
  if (discussionAt && !Number.isFinite(discussionAt.getTime())) {
    res.status(400).json({ error: "Enter a valid discussion date." });
    return;
  }

  const scored = scoreLead(
    campaign,
    parsed.data.title,
    parsed.data.excerpt,
    discussionAt,
    parsed.data.engagementCount ?? null,
  );
  try {
    const [lead] = await db
      .insert(leadsTable)
      .values({
        userId,
        campaignId: campaign.id,
        title: parsed.data.title.trim(),
        excerpt: parsed.data.excerpt.trim(),
        source: normalized.source,
        sourceUrl: normalized.url,
        discussionAt,
        engagementCount: parsed.data.engagementCount ?? null,
        relevanceScore: scored.relevanceScore,
        intentCategory: scored.intentCategory,
        intentSignals: scored.intentSignals,
        scoreReasons: scored.scoreReasons,
        ...scored.flags,
      })
      .returning();
    res.status(201).json(ImportLeadResponse.parse(lead));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "This discussion is already in your leads." });
      return;
    }
    throw error;
  }
});

router.get("/leads/:leadId", async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const lead = await findOwnedLead(accountId(req), params.data.leadId);
  if (!lead) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  res.json(leadResponse(lead));
});

router.patch("/leads/:leadId", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  const body = UpdateLeadBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Provide at least one lead field to update." });
    return;
  }

  const userId = accountId(req);
  const current = await findOwnedLead(userId, params.data.leadId);
  if (!current) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  const updates = { ...body.data, updatedAt: new Date() };
  if (body.data.status === "new") {
    Object.assign(updates, { contactedAt: null });
  } else if (
    body.data.status === "contacted" ||
    body.data.status === "replied" ||
    body.data.status === "converted"
  ) {
    Object.assign(updates, {
      contactedAt: current.contactedAt ?? new Date(),
    });
  }

  const [lead] = await db
    .update(leadsTable)
    .set(updates)
    .where(
      and(
        eq(leadsTable.id, params.data.leadId),
        eq(leadsTable.userId, userId),
      ),
    )
    .returning();
  if (!lead) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  res.json(UpdateLeadResponse.parse(lead));
});

router.delete("/leads/:leadId", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(leadsTable)
    .where(
      and(
        eq(leadsTable.id, params.data.leadId),
        eq(leadsTable.userId, accountId(req)),
      ),
    )
    .returning({ id: leadsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  res.sendStatus(204);
});

router.post("/discover/hacker-news", async (req, res): Promise<void> => {
  const parsed = DiscoverHackerNewsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = accountId(req);
  const campaign = await findOwnedCampaign(userId, parsed.data.campaignId);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  if (!campaign.preferredSources.includes("hacker_news")) {
    res.status(400).json({
      error: "Select Hacker News as a preferred source before scanning.",
    });
    return;
  }

  let scan;
  try {
    scan = await hackerNewsConnector.scan(parsed.data.maxStories ?? 40);
  } catch (error) {
    req.log.warn({ err: error }, "Hacker News discovery failed");
    res.status(502).json({
      error:
        "Hacker News is temporarily unavailable. No leads were imported; try again later.",
    });
    return;
  }

  const inserted: typeof leadsTable.$inferSelect[] = [];
  let duplicateCount = 0;
  await db.transaction(async (tx) => {
    for (const candidate of scan.candidates) {
      const scored = scoreLead(
        campaign,
        candidate.title,
        candidate.excerpt,
        candidate.publishedAt,
        candidate.engagementCount,
      );
      const matchedCampaignTerms = scored.scoreReasons.some(
        (reason) =>
          reason.startsWith("Matches campaign keyword") ||
          reason.startsWith("Matches problem"),
      );
      if (!matchedCampaignTerms || scored.flags.isIrrelevant) continue;

      const [lead] = await tx
        .insert(leadsTable)
        .values({
          userId,
          campaignId: campaign.id,
          title: candidate.title,
          excerpt: candidate.excerpt,
          source: "hacker_news",
          sourceUrl: candidate.url,
          discussionAt: candidate.publishedAt,
          engagementCount: candidate.engagementCount,
          relevanceScore: scored.relevanceScore,
          intentCategory: scored.intentCategory,
          intentSignals: scored.intentSignals,
          scoreReasons: scored.scoreReasons,
          ...scored.flags,
        })
        .onConflictDoNothing()
        .returning();
      if (lead) {
        inserted.push(lead);
      } else {
        duplicateCount += 1;
      }
    }
  });

  const settings = await getOrCreateSettings(userId);
  const visible = visibleLeads(inserted, settings);
  res.json(
    DiscoverHackerNewsResponse.parse({
      checkedCount: scan.checkedCount,
      importedCount: inserted.length,
      visibleCount: visible.length,
      duplicateCount,
      leads: visible,
    }),
  );
});

export default router;
