"use client";

import { useEffect, useState } from "react";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Session = {
  user?: SessionUser;
} | null;

export function AuthButton() {
  const [session, setSession] = useState<Session>(undefined as unknown as Session);
  const [loading, setLoading] = useState(true);
  const isConfigured = Boolean(
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_KAKAO_AUTH_ENABLED === "true"
  );

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: Session) => setSession(data))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [isConfigured]);

  if (!isConfigured || loading) return null;

  if (session?.user) {
    return (
      <div className="auth-user">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="auth-user__avatar"
          />
        ) : (
          <div className="auth-user__avatar auth-user__avatar--placeholder">
            {(session.user.name ?? "U")[0]}
          </div>
        )}
        <span className="auth-user__name">{session.user.name}</span>
        <button
          type="button"
          className="button button--ghost auth-logout-btn"
          onClick={() => {
            void fetch("/api/auth/signout", { method: "POST" }).then(() =>
              window.location.reload()
            );
          }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <a href="/api/auth/signin/kakao" className="button button--kakao auth-login-btn">
      카카오 로그인
    </a>
  );
}
