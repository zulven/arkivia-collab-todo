export type TodoId = string;

export type TodoStatus = "active" | "done";

export interface Todo {
  id: TodoId;
  title: string;
  status: TodoStatus;

  ownerUid: string;
  assigneeUids: string[];

  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface HealthResponse {
  status: "ok";
}
