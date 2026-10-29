import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  GetSettingsResponse,
  ListSourceStatusesResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { db, userSettingsTable } from "@workspace/db";
import {
  accountId,
  getOrCreateSettings,
  settingsResponse,
} from "../../lib/painradar-data";

const router: IRouter = Router();

router.get("/settings", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings(accountId(req));
  res.json(GetSettingsResponse.parse(settingsResponse(settings)));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide at least one setting to update." });
    return;
  }

  if (parsed.data.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: parsed.data.timezone,
      });
    } catch {
      res.status(400).json({ error: "Enter a valid IANA time zone." });
      return;
    }
  }

  const userId = accountId(req);
  const [settings] = await db
    .insert(userSettingsTable)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateSettingsResponse.parse(settings));
});

router.get("/sources", (_req, res) => {
  res.json(
    ListSourceStatusesResponse.parse([
      {
        id: "other",
        name: "Manual URL import",
        status: "available",
        detail:
          "Available now. Add a public discussion URL, title, and excerpt; PainRadar does not crawl pasted links.",
        manualImport: true,
      },
      {
        id: "hacker_news",
        name: "Hacker News",
        status: "available",
        detail:
          "Reads recent stories and Ask HN posts from the official public Firebase API. No credentials are required.",
        manualImport: true,
      },
      {
        id: "reddit",
        name: "Reddit",
        status: "authorization_required",
        detail:
          "A customer-authorized Reddit source connection is not configured. Paste a public discussion URL to import it manually.",
        manualImport: true,
      },
      {
        id: "x",
        name: "X",
        status: "authorization_required",
        detail:
          "An authorized X API connection is not configured. Paste a public discussion URL to import it manually.",
        manualImport: true,
      },
      {
        id: "facebook",
        name: "Facebook",
        status: "authorization_required",
        detail:
          "An authorized Facebook source connection is not configured. Paste a public discussion URL to import it manually.",
        manualImport: true,
      },
    ]),
  );
});

export default router;
