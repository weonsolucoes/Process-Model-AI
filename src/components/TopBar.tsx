"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";

interface Me {
  user: { id: string; email: string } | null;
}

export function TopBar() {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();

  useEffect(() => {
    apiFetch<Me>("/api/auth/me")
      .then(setMe)
      .catch(() => setMe({ user: null }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ user: null });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        WeOn AI Process
      </Link>
      <div>
        {me?.user ? (
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            {me.user.email} · <button onClick={logout}>Sair</button>
          </span>
        ) : me ? (
          <span style={{ fontSize: "0.85rem" }}>
            <Link href="/login">Entrar</Link>
          </span>
        ) : null}
      </div>
    </div>
  );
}
