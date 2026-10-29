import { Router, type IRouter } from "express";
import healthRouter from "./health";
import painradarRouter from "./painradar";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(painradarRouter);

export default router;
