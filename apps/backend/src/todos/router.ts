import { Router } from "express";
import { deleteTodoById, getTodos, patchReorder, patchTodo, postTodo } from "./controller.js";

export const todosRouter = Router();

todosRouter.get("/", getTodos);

todosRouter.post("/", postTodo);

todosRouter.patch("/reorder", patchReorder);

todosRouter.patch("/:id", patchTodo);

todosRouter.delete("/:id", deleteTodoById);
