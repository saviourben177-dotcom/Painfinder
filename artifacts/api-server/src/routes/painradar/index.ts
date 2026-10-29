import { Router, type IRouter } from "express";
import campaignsRouter from "./campaigns";
import dashboardRouter from "./dashboard";
import demoRouter from "./demo";
import leadsRouter from "./leads";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(campaignsRouter);
router.use(leadsRouter);
router.use(demoRouter);
router.use(dashboardRouter);
router.use(settingsRouter);

export default router;
