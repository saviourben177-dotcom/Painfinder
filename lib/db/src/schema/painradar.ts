import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const campaignStatusEnum = pgEnum("painradar_campaign_status", [
  "active",
  "paused",
]);
export const leadSourceEnum = pgEnum("painradar_lead_source", [
  "reddit",
  "hacker_news",
  "x",
  "facebook",
  "other",
]);
export const intentCategoryEnum = pgEnum("painradar_intent_category", [
  "recommendation_request",
  "solution_search",
  "general_problem",
]);
export const leadStatusEnum = pgEnum("painradar_lead_status", [
  "new",
  "contacted",
  "replied",
  "converted",
  "dismissed",
]);

const emptyTextArray = sql`ARRAY[]::text[]`;

export const campaignsTable = pgTable(
  "painradar_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    productName: text("product_name").notNull(),
    description: text("description").notNull(),
    targetAudience: text("target_audience").notNull(),
    problems: text("problems").array().notNull().default(emptyTextArray),
    keywords: text("keywords").array().notNull().default(emptyTextArray),
    excludedTopics: text("excluded_topics").array().notNull().default(emptyTextArray),
    preferredSources: text("preferred_sources").array().notNull().default(emptyTextArray),
    status: campaignStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("painradar_campaigns_user_id_idx").on(table.userId),
    index("painradar_campaigns_user_status_idx").on(table.userId, table.status),
  ],
);

export const leadsTable = pgTable(
  "painradar_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaignsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    source: leadSourceEnum("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    discussionAt: timestamp("discussion_at", { withTimezone: true }),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    engagementCount: integer("engagement_count"),
    relevanceScore: integer("relevance_score").notNull().default(0),
    intentCategory: intentCategoryEnum("intent_category")
      .notNull()
      .default("general_problem"),
    intentSignals: text("intent_signals").array().notNull().default(emptyTextArray),
    scoreReasons: text("score_reasons").array().notNull().default(emptyTextArray),
    status: leadStatusEnum("status").notNull().default("new"),
    saved: boolean("saved").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    isSpam: boolean("is_spam").notNull().default(false),
    isSelfPromotion: boolean("is_self_promotion").notNull().default(false),
    isBait: boolean("is_bait").notNull().default(false),
    isIrrelevant: boolean("is_irrelevant").notNull().default(false),
    outreachNotes: text("outreach_notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("painradar_leads_user_id_idx").on(table.userId),
    index("painradar_leads_user_campaign_idx").on(table.userId, table.campaignId),
    index("painradar_leads_user_status_idx").on(table.userId, table.status),
    index("painradar_leads_user_score_idx").on(table.userId, table.relevanceScore),
    uniqueIndex("painradar_leads_user_source_url_unique").on(
      table.userId,
      table.sourceUrl,
    ),
  ],
);

export const userSettingsTable = pgTable("painradar_user_settings", {
  userId: text("user_id").primaryKey(),
  timezone: text("timezone").notNull().default("UTC"),
  minimumRelevance: integer("minimum_relevance").notNull().default(0),
  hideFlagged: boolean("hide_flagged").notNull().default(true),
  showDemoData: boolean("show_demo_data").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
export type UserSettings = typeof userSettingsTable.$inferSelect;
