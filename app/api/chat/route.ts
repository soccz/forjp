import { resolveChatProvider } from "@/lib/providers/chat";
import type { ChatCollected, ChatMessage, ChatStep } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message: string;
      history: ChatMessage[];
      step: ChatStep;
      collected: Partial<ChatCollected>;
    };

    const provider = resolveChatProvider();
    const result = await provider.respond(
      body.message,
      body.history,
      body.step,
      body.collected
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "chat_failed" }, { status: 500 });
  }
}
