import { z } from "zod";

export type TodoId = string;

export type TodoStatus = "active" | "done";

export type TodoPriority = "low" | "medium" | "high";

export interface Todo {
  id: TodoId;
  title: string;
  description?: string | null;
  status: TodoStatus;

  createdByUid: string;
  ownerUid: string;
  assigneeUids: string[];

  position: number;
  priority: TodoPriority;

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

export const TodoStatusSchema = z.union([z.literal("active"), z.literal("done")]);

export const TodoPrioritySchema = z.union([z.literal("low"), z.literal("medium"), z.literal("high")]);

export const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: TodoStatusSchema,
  createdByUid: z.string(),
  ownerUid: z.string(),
  assigneeUids: z.array(z.string()),
  position: z.number(),
  priority: TodoPrioritySchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const TodosListResponseSchema = z.object({
  todos: z.array(TodoSchema)
});

export const TodoResponseSchema = z.object({
  todo: TodoSchema
});

export const TodoCreateRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: TodoPrioritySchema.optional(),
  assigneeUids: z.array(z.string()).optional()
});

export const TodoUpdateRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: TodoStatusSchema.optional(),
    priority: TodoPrioritySchema.optional(),
    assigneeUids: z.array(z.string()).optional()
  })
  .refine((v: Record<string, unknown>) => Object.keys(v).length > 0, {
    message: "At least one field must be provided"
  });

export const TodoReorderRequestSchema = z.object({
  orderedIds: z.array(z.string()).min(1)
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok")
});
