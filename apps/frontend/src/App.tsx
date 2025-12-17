import { useEffect, useState } from "react";
import { useAuth } from "./auth";

type HealthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok" }
  | { status: "error"; message: string };

type MeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: { uid?: string; email: string | null; name: string | null } }
  | { status: "error"; message: string };

type Todo = {
  id: string;
  title: string;
  status: "active" | "done";
  ownerUid: string;
  assigneeUids: string[];
  createdAt: string;
  updatedAt: string;
};

type UserSummary = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type TodosState =
  | { status: "idle"; todos: Todo[] }
  | { status: "loading"; todos: Todo[] }
  | { status: "ok"; todos: Todo[] }
  | { status: "error"; todos: Todo[]; message: string };

export default function App() {
  const [health, setHealth] = useState<HealthState>({ status: "idle" });
  const [me, setMe] = useState<MeState>({ status: "idle" });
  const [todosState, setTodosState] = useState<TodosState>({ status: "idle", todos: [] });
  const [newTitle, setNewTitle] = useState("");
  const [assigningTodoId, setAssigningTodoId] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSummary[]>([]);
  const [userSearchStatus, setUserSearchStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const { state: authState, signInWithGoogle, signOut } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setHealth({ status: "loading" });
      try {
        const res = await fetch("/api/health");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { status?: unknown };
        if (!cancelled) {
          setHealth(data.status === "ok" ? { status: "ok" } : { status: "error", message: "Unexpected response" });
        }
      } catch (err) {
        if (!cancelled) {
          setHealth({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (authState.status !== "signed_in") {
        setMe({ status: "idle" });
        return;
      }

      setMe({ status: "loading" });
      try {
        const token = await authState.user.getIdToken();
        const res = await fetch("/api/me", {
          headers: {
            authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { uid?: string; email: string | null; name: string | null };
        if (!cancelled) {
          setMe({ status: "ok", data });
        }
      } catch (err) {
        if (!cancelled) {
          setMe({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }
      }
    }

    void loadMe();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  useEffect(() => {
    let cancelled = false;

    async function syncMe() {
      if (authState.status !== "signed_in") return;

      try {
        const token = await authState.user.getIdToken();
        await fetch("/api/users/me", {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`
          }
        });
      } catch {
        // Best-effort; ignore
      }
    }

    void syncMe();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  useEffect(() => {
    let cancelled = false;

    async function loadTodos() {
      if (authState.status !== "signed_in") {
        setTodosState({ status: "idle", todos: [] });
        return;
      }

      setTodosState((prev) => ({ status: "loading", todos: prev.todos }));
      try {
        const token = await authState.user.getIdToken();
        const res = await fetch("/api/todos", {
          headers: {
            authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { todos: Todo[] };
        if (!cancelled) {
          setTodosState({ status: "ok", todos: data.todos });
        }
      } catch (err) {
        if (!cancelled) {
          setTodosState((prev) => ({
            status: "error",
            todos: prev.todos,
            message: err instanceof Error ? err.message : "Unknown error"
          }));
        }
      }
    }

    void loadTodos();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  async function createTodo() {
    if (authState.status !== "signed_in") return;

    const title = newTitle.trim();
    if (!title) return;

    const token = await authState.user.getIdToken();
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as { todo: Todo };
    setNewTitle("");
    setTodosState((prev) => ({ status: "ok", todos: [data.todo, ...prev.todos] }));
  }

  async function toggleTodo(todo: Todo) {
    if (authState.status !== "signed_in") return;

    const token = await authState.user.getIdToken();
    const nextStatus = todo.status === "done" ? "active" : "done";
    const res = await fetch(`/api/todos/${encodeURIComponent(todo.id)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as { todo: Todo };
    setTodosState((prev) => ({
      status: "ok",
      todos: prev.todos.map((t) => (t.id === todo.id ? data.todo : t))
    }));
  }

  async function deleteTodo(todo: Todo) {
    if (authState.status !== "signed_in") return;

    const token = await authState.user.getIdToken();
    const res = await fetch(`/api/todos/${encodeURIComponent(todo.id)}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!res.ok && res.status !== 204) {
      throw new Error(`HTTP ${res.status}`);
    }

    setTodosState((prev) => ({ status: "ok", todos: prev.todos.filter((t) => t.id !== todo.id) }));
  }

  async function searchUsers(q: string) {
    if (authState.status !== "signed_in") return;
    setUserSearchStatus("loading");
    try {
      const token = await authState.user.getIdToken();
      const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { users: UserSummary[] };
      setUserResults(data.users);
      setUserSearchStatus("ok");
    } catch {
      setUserResults([]);
      setUserSearchStatus("error");
    }
  }

  async function updateAssignees(todo: Todo, assigneeUids: string[]) {
    if (authState.status !== "signed_in") return;
    const token = await authState.user.getIdToken();
    const res = await fetch(`/api/todos/${encodeURIComponent(todo.id)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ assigneeUids })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as { todo: Todo };
    setTodosState((prev) => ({
      status: "ok",
      todos: prev.todos.map((t) => (t.id === todo.id ? data.todo : t))
    }));
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Collab Todo</h1>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Auth</h2>
        <div style={{ marginTop: 8 }}>
          {authState.status === "loading" && <span>Loading…</span>}
          {authState.status === "signed_out" && (
            <button type="button" onClick={() => void signInWithGoogle()}>
              Sign in with Google
            </button>
          )}
          {authState.status === "signed_in" && (
            <div>
              <div>Signed in as {authState.user.displayName ?? authState.user.email ?? authState.user.uid}</div>
              <button type="button" onClick={() => void signOut()} style={{ marginTop: 8 }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Backend auth</h2>
        <div style={{ marginTop: 8 }}>
          {me.status === "idle" && <span>Sign in to test.</span>}
          {me.status === "loading" && <span>Loading…</span>}
          {me.status === "ok" && (
            <span>
              OK (uid: {me.data.uid ?? "n/a"}, email: {me.data.email ?? "n/a"})
            </span>
          )}
          {me.status === "error" && <span style={{ color: "crimson" }}>Error: {me.message}</span>}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Backend health</h2>
        <div style={{ marginTop: 8 }}>
          {health.status === "idle" && <span>Idle</span>}
          {health.status === "loading" && <span>Loading…</span>}
          {health.status === "ok" && <span>OK</span>}
          {health.status === "error" && (
            <span style={{ color: "crimson" }}>Error: {health.message}</span>
          )}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Todos</h2>

        {authState.status !== "signed_in" ? (
          <div style={{ marginTop: 8 }}>Sign in to manage todos.</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createTodo().catch((err) => {
                  setTodosState((prev) => ({
                    status: "error",
                    todos: prev.todos,
                    message: err instanceof Error ? err.message : "Unknown error"
                  }));
                });
              }}
            >
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New todo title"
                style={{ width: 280, marginRight: 8 }}
              />
              <button type="submit">Add</button>
            </form>

            <div style={{ marginTop: 8 }}>
              {todosState.status === "loading" && <div>Loading…</div>}
              {todosState.status === "error" && (
                <div style={{ color: "crimson" }}>Error: {todosState.message}</div>
              )}
            </div>

            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {todosState.todos.map((t) => (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  <label style={{ marginRight: 8 }}>
                    <input
                      type="checkbox"
                      checked={t.status === "done"}
                      onChange={() => void toggleTodo(t).catch(() => {})}
                      style={{ marginRight: 6 }}
                    />
                    {t.title}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAssigningTodoId((prev) => {
                        const next = prev === t.id ? null : t.id;
                        if (next) {
                          setUserQuery("");
                          setUserResults([]);
                          setUserSearchStatus("idle");
                          void searchUsers("");
                        }
                        return next;
                      });
                    }}
                    style={{ marginRight: 8 }}
                  >
                    Assign
                  </button>
                  <button type="button" onClick={() => void deleteTodo(t).catch(() => {})}>
                    Delete
                  </button>

                  {assigningTodoId === t.id && (
                    <div style={{ marginTop: 6, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
                      <div style={{ marginBottom: 6 }}>
                        <strong>Assignees</strong>
                        {t.assigneeUids.length === 0 ? (
                          <div style={{ marginTop: 4 }}>None</div>
                        ) : (
                          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                            {t.assigneeUids.map((uid) => (
                              <li key={uid}>
                                <code>{uid}</code>{" "}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateAssignees(
                                      t,
                                      t.assigneeUids.filter((x) => x !== uid)
                                    ).catch(() => {})
                                  }
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <input
                          value={userQuery}
                          onChange={(e) => {
                            const q = e.target.value;
                            setUserQuery(q);
                            void searchUsers(q);
                          }}
                          placeholder="Search users by name or email"
                          style={{ width: 280, marginRight: 8 }}
                        />
                        {userSearchStatus === "loading" && <span>Searching…</span>}
                        {userSearchStatus === "error" && (
                          <span style={{ color: "crimson" }}>Search failed</span>
                        )}
                      </div>

                      {userSearchStatus === "ok" && userResults.length === 0 && (
                        <div style={{ marginTop: 6, color: "#555" }}>
                          No users found. Ask the other user to sign in once so they appear in the user list.
                        </div>
                      )}

                      {userResults.length > 0 && (
                        <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                          {userResults.map((u) => {
                            const label =
                              u.displayName && u.email
                                ? `${u.displayName} (${u.email})`
                                : (u.displayName ?? u.email ?? u.uid);
                            const already = t.assigneeUids.includes(u.uid);
                            return (
                              <li key={u.uid}>
                                <button
                                  type="button"
                                  disabled={already}
                                  onClick={() =>
                                    void updateAssignees(
                                      t,
                                      Array.from(new Set([...t.assigneeUids, u.uid]))
                                    ).catch(() => {})
                                  }
                                >
                                  {already ? "Assigned" : "Assign"}
                                </button>{" "}
                                <span>{label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
