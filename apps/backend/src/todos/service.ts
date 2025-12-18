import { FieldValue, type UpdateData, type Timestamp } from "firebase-admin/firestore";
import type { TodoPriority } from "@arkivia/shared";
import {
  commitReorder,
  createTodo,
  deleteTodo as deleteTodoRepo,
  getTodoRefAndDoc,
  listTodosForUser,
  reorderTodos,
  updateTodo as updateTodoRepo,
  type ApiTodo,
  type TodoDoc
} from "./repo.js";

export async function listTodos(uid: string): Promise<ApiTodo[]> {
  return listTodosForUser(uid);
}

export async function createTodoForUser(input: {
  uid: string;
  title: string;
  description?: string;
  priority: TodoPriority;
  assigneeUids: string[];
}): Promise<ApiTodo> {
  return createTodo({
    title: input.title,
    description: input.description,
    priority: input.priority,
    ownerUid: input.uid,
    createdByUid: input.uid,
    assigneeUids: input.assigneeUids
  });
}

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

function ensureOwnerOrAssignee(doc: TodoDoc, uid: string) {
  const ok = doc.ownerUid === uid || doc.assigneeUids.includes(uid);
  if (!ok) throw new ForbiddenError("Forbidden");
}

function ensureOwner(doc: TodoDoc, uid: string) {
  if (doc.ownerUid !== uid) throw new ForbiddenError("Forbidden");
}

export async function updateTodo(input: {
  uid: string;
  id: string;
  patch: {
    title?: string;
    description?: string;
    status?: "active" | "done";
    priority?: TodoPriority;
    assigneeUids?: string[];
  };
}): Promise<ApiTodo> {
  const loaded = await getTodoRefAndDoc(input.id);
  if (!loaded) throw new NotFoundError("Not found");

  ensureOwnerOrAssignee(loaded.doc, input.uid);

  const update: UpdateData<TodoDoc> = {
    updatedAt: FieldValue.serverTimestamp() as unknown as Timestamp
  };

  if (typeof input.patch.title === "string") update.title = input.patch.title;
  if (typeof input.patch.description === "string") update.description = input.patch.description;
  if (input.patch.status) update.status = input.patch.status;
  if (input.patch.priority) update.priority = input.patch.priority;
  if (Array.isArray(input.patch.assigneeUids)) update.assigneeUids = input.patch.assigneeUids;

  return updateTodoRepo(loaded.ref, update);
}

export async function deleteTodo(input: { uid: string; id: string }): Promise<void> {
  const loaded = await getTodoRefAndDoc(input.id);
  if (!loaded) throw new NotFoundError("Not found");

  ensureOwner(loaded.doc, input.uid);
  await deleteTodoRepo(loaded.ref);
}

export async function reorder(input: { uid: string; orderedIds: string[] }): Promise<void> {
  const { docs } = await reorderTodos(input.orderedIds);
  if (docs.length === 0) throw new NotFoundError("Todo not found");

  for (const { doc } of docs) {
    ensureOwnerOrAssignee(doc, input.uid);
  }

  await commitReorder(input.orderedIds);
}
