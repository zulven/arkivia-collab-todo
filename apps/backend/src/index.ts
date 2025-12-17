import express, { type Request, type Response } from "express";
import { requireAuth } from "./authMiddleware.js";

const app = express();

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/me", requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    uid: req.auth?.uid,
    email: req.auth?.email ?? null,
    name: req.auth?.name ?? null
  });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  // Intentionally minimal (scaffold)
  console.log(`listening on :${port}`);
});
