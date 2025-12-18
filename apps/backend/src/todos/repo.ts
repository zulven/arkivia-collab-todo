import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type Timestamp,
  type UpdateData
} from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../firebaseAdmin.js";

export type TodoDoc = {
  title: string;
  description?: string;
  status: "active" | "done";
  createdByUid?: string;
  ownerUid: string;
  assigneeUids: string[];
  position?: number;
  priority?: "low" | "medium" | "high";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ApiTodo = {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "done";
  createdByUid: string;
  ownerUid: string;
  assigneeUids: string[];
  position: number;
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
};

function toIsoString(ts: Timestamp): string {
  return ts.toDate().toISOString();
}

function toApiTodo(id: string, doc: TodoDoc): ApiTodo {
  const position = doc.position ?? doc.createdAt.toMillis();
  return {
    id,
    title: doc.title,
    description: doc.description ?? null,
    status: doc.status,
    createdByUid: doc.createdByUid ?? doc.ownerUid,
    ownerUid: doc.ownerUid,
    assigneeUids: doc.assigneeUids,
    position,
    priority: doc.priority ?? "medium",
    createdAt: toIsoString(doc.createdAt),
    updatedAt: toIsoString(doc.updatedAt)
  };
}

function todosCollection() {
  const db = getFirestore(getFirebaseAdminApp());
  return db.collection("todos");
}

export async function listTodosForUser(uid: string): Promise<ApiTodo[]> {
  const todos = todosCollection();

  const [ownedSnap, assignedSnap] = await Promise.all([
    todos.where("ownerUid", "==", uid).get(),
    todos.where("assigneeUids", "array-contains", uid).get()
  ]);

  const map = new Map<string, ApiTodo>();
  for (const snap of [ownedSnap, assignedSnap]) {
    for (const doc of snap.docs) {
      map.set(doc.id, toApiTodo(doc.id, doc.data() as TodoDoc));
    }
  }

  return Array.from(map.values()).sort((a, b) => a.position - b.position);
}

export async function createTodo(input: {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  ownerUid: string;
  createdByUid: string;
  assigneeUids: string[];
}): Promise<ApiTodo> {
  const todos = todosCollection();

  const docRef = await todos.add({
    title: input.title,
    description: input.description,
    status: "active",
    createdByUid: input.createdByUid,
    ownerUid: input.ownerUid,
    assigneeUids: input.assigneeUids,
    position: Date.now(),
    priority: input.priority,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const created = await docRef.get();
  return toApiTodo(created.id, created.data() as TodoDoc);
}

export async function getTodoRefAndDoc(id: string): Promise<{
  ref: DocumentReference;
  doc: TodoDoc;
} | null> {
  const todos = todosCollection();
  const ref = todos.doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, doc: snap.data() as TodoDoc };
}

export async function updateTodo(ref: DocumentReference, update: UpdateData<TodoDoc>): Promise<ApiTodo> {
  await ref.update(update);
  const updated = await ref.get();
  return toApiTodo(updated.id, updated.data() as TodoDoc);
}

export async function deleteTodo(ref: DocumentReference): Promise<void> {
  await ref.delete();
}

export async function reorderTodos(orderedIds: string[]): Promise<{
  refs: DocumentReference[];
  docs: Array<{ id: string; doc: TodoDoc }>;
}> {
  const todos = todosCollection();
  const refs = orderedIds.map((id) => todos.doc(id));
  const snaps = await getFirestore(getFirebaseAdminApp()).getAll(...refs);

  const docs: Array<{ id: string; doc: TodoDoc }> = [];
  for (const snap of snaps) {
    if (!snap.exists) {
      return { refs: [], docs: [] };
    }
    docs.push({ id: snap.id, doc: snap.data() as TodoDoc });
  }

  return { refs, docs };
}

export async function commitReorder(orderedIds: string[]): Promise<void> {
  const db = getFirestore(getFirebaseAdminApp());
  const todos = db.collection("todos");

  const batch = db.batch();
  for (let i = 0; i < orderedIds.length; i++) {
    batch.update(todos.doc(orderedIds[i]!), {
      position: i,
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
}
