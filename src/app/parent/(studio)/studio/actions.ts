"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireParentMode } from "@/lib/parent/access";
import { getConfiguredTextProvider } from "@/lib/providers/server-config";
import type { StudioChatState } from "@/lib/studio/chat-state";
import { runStudioMessage } from "@/lib/studio/orchestrator";

const messageSchema = z.string().trim().min(1).max(120000);

export async function studioChatAction(
  previousState: StudioChatState,
  formData: FormData,
): Promise<StudioChatState> {
  await requireParentMode();
  const message = messageSchema.parse(formData.get("message"));
  let response: Awaited<ReturnType<typeof runStudioMessage>>;

  try {
    response = await runStudioMessage(message, {
      textProvider: getConfiguredTextProvider(),
    });
  } catch (error) {
    response = {
      tool: "error",
      text: error instanceof Error ? error.message : "Не удалось выполнить команду.",
    };
  }

  if (response.touchedBookId) {
    revalidatePath("/parent/books");
    revalidatePath(`/parent/books/${response.touchedBookId}`);
    revalidatePath(`/books/${response.touchedBookId}`);
  }

  const displayedUserMessage = message.startsWith("/materialize-json ")
    ? `Материализовать утверждённый StoryPackage (${message.length.toLocaleString("ru-RU")} символов)`
    : message;
  const appended: StudioChatState["messages"] = [
    { role: "user", text: displayedUserMessage },
    { role: "assistant", text: response.text, tool: response.tool },
  ];
  const messages: StudioChatState["messages"] = [
    ...previousState.messages,
    ...appended,
  ].slice(-20);

  return { sequence: previousState.sequence + 1, messages };
}
