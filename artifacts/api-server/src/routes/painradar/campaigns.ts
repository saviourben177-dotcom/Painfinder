import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateCampaignBody,
  CreateCampaignResponse,
  DeleteCampaignParams,
  UpdateCampaignBody,
  UpdateCampaignParams,
  UpdateCampaignResponse,
} from "@workspace/api-zod";
import { campaignsTable, db } from "@workspace/db";
import {
  accountId,
  campaignResponse,
} from "../../lib/painradar-data";

const router: IRouter = Router();

router.get("/campaigns", async (req, res): Promise<void> => {
  const userId = accountId(req);
  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId))
    .orderBy(desc(campaignsTable.updatedAt));
  res.json(campaigns.map(campaignResponse));
});

router.post("/campaigns", async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.keywords.length === 0 && parsed.data.problems.length === 0) {
    res.status(400).json({ error: "Add at least one campaign keyword or problem." });
    return;
  }
  const userId = accountId(req);
  const [campaign] = await db
    .insert(campaignsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(CreateCampaignResponse.parse(campaign));
});

router.patch("/campaigns/:campaignId", async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  const body = UpdateCampaignBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Provide at least one campaign field to update." });
    return;
  }

  const userId = accountId(req);
  const [current] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, params.data.campaignId),
        eq(campaignsTable.userId, userId),
      ),
    )
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  const nextKeywords = body.data.keywords ?? current.keywords;
  const nextProblems = body.data.problems ?? current.problems;
  if (nextKeywords.length === 0 && nextProblems.length === 0) {
    res.status(400).json({ error: "Keep at least one campaign keyword or problem." });
    return;
  }

  const [campaign] = await db
    .update(campaignsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(
      and(
        eq(campaignsTable.id, params.data.campaignId),
        eq(campaignsTable.userId, userId),
      ),
    )
    .returning();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  res.json(UpdateCampaignResponse.parse(campaign));
});

router.delete("/campaigns/:campaignId", async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, params.data.campaignId),
        eq(campaignsTable.userId, accountId(req)),
      ),
    )
    .returning({ id: campaignsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;
