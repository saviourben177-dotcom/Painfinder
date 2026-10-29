import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { CreateDemoWorkspaceResponse } from "@workspace/api-zod";
import { campaignsTable, db, leadsTable } from "@workspace/db";
import { scoreLead } from "../../lib/painradar-scoring";
import { accountId, campaignResponse, leadResponse } from "../../lib/painradar-data";

const router: IRouter = Router();
const demoProductName = "TinyForm — demo workspace";

const examples = [
  {
    title: "Ask HN: What do you use to build a freelance portfolio?",
    excerpt:
      "I need a portfolio website for client work. Any recommendations for a simple website builder with polished templates?",
    source: "hacker_news" as const,
    daysAgo: 1,
    engagementCount: 18,
  },
  {
    title: "Looking for a simple landing-page builder for my side project",
    excerpt:
      "I want to publish a landing page without spending a weekend in CSS. I am comparing no-code website builders and templates.",
    source: "reddit" as const,
    daysAgo: 2,
    engagementCount: 24,
  },
  {
    title: "Does anyone have advice for improving a portfolio site?",
    excerpt:
      "My portfolio feels unfinished and I have trouble getting the layout right. What tools or templates do you recommend?",
    source: "reddit" as const,
    daysAgo: 4,
    engagementCount: 9,
  },
  {
    title: "I keep putting off editing my website because the templates are rigid",
    excerpt:
      "Every small change turns into a layout fight. I wish it were easier to update my freelance website between projects.",
    source: "hacker_news" as const,
    daysAgo: 9,
    engagementCount: 31,
  },
  {
    title: "Need a no-code portfolio template with a contact form",
    excerpt:
      "I am searching for a lightweight portfolio website builder that works for a solo designer and does not need custom code.",
    source: "other" as const,
    daysAgo: 14,
    engagementCount: 5,
  },
];

router.post("/demo/workspace", async (req, res): Promise<void> => {
  const userId = accountId(req);
  const result = await db.transaction(async (tx) => {
    const [existingCampaign] = await tx
      .select()
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.userId, userId),
          eq(campaignsTable.productName, demoProductName),
        ),
      )
      .limit(1);

    const [campaign] = existingCampaign
      ? [existingCampaign]
      : await tx
          .insert(campaignsTable)
          .values({
            userId,
            productName: demoProductName,
            description:
              "A lightweight site builder for publishing a polished portfolio or landing page without custom code.",
            targetAudience:
              "Indie developers, freelancers, solo designers, small service businesses",
            problems: [
              "no-code website builder",
              "landing page design",
              "portfolio website",
            ],
            keywords: [
              "website builder",
              "landing page",
              "portfolio website",
              "no-code website",
              "website template",
            ],
            excludedTopics: ["crypto"],
            preferredSources: ["hacker_news", "reddit", "other"],
          })
          .returning();

    const previous = await tx
      .select({ sourceUrl: leadsTable.sourceUrl })
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.userId, userId),
          eq(leadsTable.campaignId, campaign.id),
          eq(leadsTable.isDemo, true),
        ),
      );
    const previousUrls = new Set(previous.map((row) => row.sourceUrl));
    const now = Date.now();

    for (const [index, example] of examples.entries()) {
      const sourceUrl = `https://example.com/painradar-demo/${index + 1}`;
      if (previousUrls.has(sourceUrl)) continue;
      const discussionAt = new Date(
        now - example.daysAgo * 24 * 60 * 60 * 1000,
      );
      const scored = scoreLead(
        campaign,
        example.title,
        example.excerpt,
        discussionAt,
        example.engagementCount,
      );
      await tx
        .insert(leadsTable)
        .values({
          userId,
          campaignId: campaign.id,
          title: example.title,
          excerpt: example.excerpt,
          source: example.source,
          sourceUrl,
          discussionAt,
          engagementCount: example.engagementCount,
          isDemo: true,
          relevanceScore: scored.relevanceScore,
          intentCategory: scored.intentCategory,
          intentSignals: scored.intentSignals,
          scoreReasons: scored.scoreReasons,
          ...scored.flags,
        })
        .onConflictDoNothing();
    }

    const leads = await tx
      .select()
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.userId, userId),
          eq(leadsTable.campaignId, campaign.id),
          eq(leadsTable.isDemo, true),
        ),
      );
    return { campaign, leads };
  });

  res.status(201).json(
    CreateDemoWorkspaceResponse.parse({
      campaign: campaignResponse(result.campaign),
      leads: result.leads.map(leadResponse),
    }),
  );
});

export default router;
