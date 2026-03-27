"use client";

import { useState } from "react";
import { loadKakaoSdk, shareViaKakaoTalk } from "@/lib/kakao-sdk";

type Props = {
  title: string;
  description: string;
  url: string;
};

export function KakaoShareButton({ title, description, url }: Props) {
  const [loading, setLoading] = useState(false);
  const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

  async function handleShare() {
    if (!kakaoJsKey) {
      // Fallback: copy URL
      try {
        await navigator.clipboard.writeText(url);
        alert("링크를 복사했습니다.");
      } catch {
        alert(`공유 링크: ${url}`);
      }
      return;
    }

    setLoading(true);
    try {
      await loadKakaoSdk(kakaoJsKey);
      shareViaKakaoTalk({ title, description, url });
    } catch {
      await navigator.clipboard.writeText(url).catch(() => undefined);
      alert("링크를 복사했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="button button--kakao"
      onClick={() => void handleShare()}
      disabled={loading}
    >
      {loading ? "공유 중..." : (kakaoJsKey ? "카카오톡 공유" : "링크 복사")}
    </button>
  );
}
