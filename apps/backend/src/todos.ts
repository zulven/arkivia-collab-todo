import { Router, type Request, type Response } from "express";
import {
  FieldValue,
  getFirestore,
  type Timestamp,
  type UpdateData
} from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./firebaseAdmin.js";

type TodoDoc = {
  title: string;
  status: "active" | "done";
  ownerUid: string;
  assigneeUids: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

function toIsoString(ts: Timestamp): string {
  return ts.toDate().toISOString();
}

function toApiTodo(id: string, doc: TodoDoc) {
  return {
    id,
    title: doc.title,
    status: doc.status,
    ownerUid: doc.ownerUid,
    assigneeUids: doc.assigneeUids,
    createdAt: toIsoString(doc.createdAt),
    updatedAt: toIsoString(doc.updatedAt)
  };
}

export const todosRouter = Router();

todosRouter.get("/", async (req: Request, res: Response) => {
  const uid = req.auth?.uid;
  if (!uid) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const db = getFirestore(getFirebaseAdminApp());
  const todos = db.collection("todos");

  const [ownedSnap, assignedSnap] = await Promise.all([
    todos.where("ownerUid", "==", uid).get(),
    todos.where("assigneeUids", "array-contains", uid).get()
  ]);

  const map = new Map<string, ReturnType<typeof toApiTodo>>();
  for (const snap of [ownedSnap, assignedSnap]) {
    for (const doc of snap.docs) {
      map.set(doc.id, toApiTodo(doc.id, doc.data() as TodoDoc));
    }
  }

  res.status(200).json({ todos: Array.from(map.values()) });
});

todosRouter.post("/", async (req: Request, res: Response) => {
  const uid = req.auth?.uid;
  if (!uid) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const assigneeUidsRaw = Array.isArray(req.body?.assigneeUids) ? req.body.assigneeUids : [];
  const assigneeUids = assigneeUidsRaw
    .filter((v: unknown) => typeof v === "string")
    .map((v: string) => v.trim())
    .filter((v: string) => v.length > 0);

  const db = getFirestore(getFirebaseAdminApp());
  const docRef = await db.collection("todos").add({
    title,
    status: "active",
    ownerUid: uid,
    assigneeUids,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const created = await docRef.get();
  res.status(201).json({ todo: toApiTodo(created.id, created.data() as TodoDoc) });
});

todosRouter.patch("/:id", async (req: Request, res: Response) => {
  const uid = req.auth?.uid;
  if (!uid) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing todo id" });
    return;
  }
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection("todos").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const current = snap.data() as TodoDoc;
  const isOwnerOrAssignee = current.ownerUid === uid || current.assigneeUids.includes(uid);
  if (!isOwnerOrAssignee) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const update: UpdateData<TodoDoc> = {
    updatedAt: FieldValue.serverTimestamp() as unknown as Timestamp
  };

  if (typeof req.body?.title === "string") {
    const title = req.body.title.trim();
    if (!title) {
      res.status(400).json({ error: "title cannot be empty" });
      return;
    }
    update.title = title;
  }

  if (req.body?.status === "active" || req.body?.status === "done") {
    update.status = req.body.status;
  }

  if (Array.isArray(req.body?.assigneeUids)) {
    const assigneeUids = req.body.assigneeUids
      .filter((v: unknown) => typeof v === "string")
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 0);
    update.assigneeUids = assigneeUids;
  }

  await ref.update(update);
  const updated = await ref.get();
  res.status(200).json({ todo: toApiTodo(updated.id, updated.data() as TodoDoc) });
});

todosRouter.delete("/:id", async (req: Request, res: Response) => {
  const uid = req.auth?.uid;
  if (!uid) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing todo id" });
    return;
  }
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection("todos").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const current = snap.data() as TodoDoc;
  if (current.ownerUid !== uid) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await ref.delete();
  res.status(204).send();
});
