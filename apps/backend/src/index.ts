import express, { type Request, type Response } from "express";
import { requireAuth } from "./authMiddleware.js";
import { todosRouter } from "./todos.js";
import { usersRouter } from "./users.js";

const app = express();

app.use(express.json());

function registerRoutes(prefix: "" | "/api") {
  app.get(`${prefix}/health`, (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.get(`${prefix}/me`, requireAuth, (req: Request, res: Response) => {
    res.status(200).json({
      uid: req.auth?.uid,
      email: req.auth?.email ?? null,
      name: req.auth?.name ?? null
    });
  });

  app.use(`${prefix}/todos`, requireAuth, todosRouter);

  app.use(`${prefix}/users`, requireAuth, usersRouter);
}

registerRoutes("");
registerRoutes("/api");

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  // Intentionally minimal (scaffold)
  console.log(`listening on :${port}`);
});
