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

export default function App() {
  const [health, setHealth] = useState<HealthState>({ status: "idle" });
  const [me, setMe] = useState<MeState>({ status: "idle" });
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
    </main>
  );
}
