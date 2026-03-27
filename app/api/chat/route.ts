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

    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (!Array.isArray(body.history)) {
      return NextResponse.json({ error: "history must be an array" }, { status: 400 });
    }
    if (!body.step) {
      return NextResponse.json({ error: "step is required" }, { status: 400 });
    }

    const provider = resolveChatProvider();
    const result = await provider.respond(
      body.message,
      body.history,
      body.step,
      body.collected ?? {}
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "chat_failed" }, { status: 500 });
  }
}
