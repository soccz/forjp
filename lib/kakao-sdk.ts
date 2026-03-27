declare global {
  interface Window {
    Kakao: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: {
        sendDefault: (params: {
          objectType: string;
          content: {
            title: string;
            description: string;
            imageUrl?: string;
            link: { mobileWebUrl: string; webUrl: string };
          };
        }) => void;
      };
    };
  }
}

export function loadKakaoSdk(appKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("server_side"));
      return;
    }

    if (window.Kakao?.isInitialized?.()) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://developers.kakao.com/sdk/js/kakao.js";
    script.onload = () => {
      window.Kakao.init(appKey);
      resolve();
    };
    script.onerror = () => reject(new Error("sdk_load_failed"));
    document.head.appendChild(script);
  });
}

export function shareViaKakaoTalk(params: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
}) {
  if (!window.Kakao?.isInitialized?.()) return;

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: params.title,
      description: params.description,
      imageUrl: params.imageUrl,
      link: {
        mobileWebUrl: params.url,
        webUrl: params.url,
      },
    },
  });
}
