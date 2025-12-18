import type { Request, Response } from "express";
import {
  TodoCreateRequestSchema,
  TodoReorderRequestSchema,
  TodoUpdateRequestSchema
} from "@arkivia/shared";
import {
  ForbiddenError,
  NotFoundError,
  createTodoForUser,
  deleteTodo,
  listTodos,
  reorder,
  updateTodo
} from "./service.js";

function getUid(req: Request, res: Response): string | null {
  const uid = req.auth?.uid;
  if (!uid) {
    res.status(401).json({ error: "Unauthenticated" });
    return null;
  }
  return uid;
}

function handleServiceError(err: unknown, res: Response) {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Unknown error" });
}

export async function getTodos(req: Request, res: Response) {
  const uid = getUid(req, res);
  if (!uid) return;

  const todos = await listTodos(uid);
  res.status(200).json({ todos });
}

export async function postTodo(req: Request, res: Response) {
  const uid = getUid(req, res);
  if (!uid) return;

  const parsed = TodoCreateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  const title = parsed.data.title.trim();
  const description = typeof parsed.data.description === "string" ? parsed.data.description.trim() : undefined;
  const priority = parsed.data.priority ?? "medium";
  const assigneeUids = (parsed.data.assigneeUids ?? []).map((v) => v.trim()).filter((v) => v.length > 0);

  const todo = await createTodoForUser({
    uid,
    title,
    description,
    priority,
    assigneeUids
  });

  res.status(201).json({ todo });
}

export async function patchReorder(req: Request, res: Response) {
  const uid = getUid(req, res);
  if (!uid) return;

  const parsed = TodoReorderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  const orderedIds = parsed.data.orderedIds.map((v) => v.trim()).filter((v) => v.length > 0);
  if (orderedIds.length === 0) {
    res.status(400).json({ error: "orderedIds is required" });
    return;
  }

  try {
    await reorder({ uid, orderedIds });
    res.status(200).json({ ok: true });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function patchTodo(req: Request, res: Response) {
  const uid = getUid(req, res);
  if (!uid) return;

  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing todo id" });
    return;
  }

  const parsed = TodoUpdateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  try {
    const todo = await updateTodo({
      uid,
      id,
      patch: {
        title: typeof parsed.data.title === "string" ? parsed.data.title.trim() : undefined,
        description: typeof parsed.data.description === "string" ? parsed.data.description.trim() : undefined,
        status: parsed.data.status,
        priority: parsed.data.priority,
        assigneeUids: Array.isArray(parsed.data.assigneeUids)
          ? parsed.data.assigneeUids.map((v) => v.trim()).filter((v) => v.length > 0)
          : undefined
      }
    });
    res.status(200).json({ todo });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function deleteTodoById(req: Request, res: Response) {
  const uid = getUid(req, res);
  if (!uid) return;

  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing todo id" });
    return;
  }

  try {
    await deleteTodo({ uid, id });
    res.status(204).send();
  } catch (err) {
    handleServiceError(err, res);
  }
}
