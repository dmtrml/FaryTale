export type StudioChatState = {
  sequence: number;
  messages: Array<{
    role: "user" | "assistant";
    text: string;
    tool?: string;
  }>;
};

export const initialStudioChatState: StudioChatState = {
  sequence: 0,
  messages: [
    {
      role: "assistant",
      tool: "help",
      text: "Studio управляет только явными project tools. Введите /help, чтобы увидеть команды. Все изменения книг сохраняются в content/.",
    },
  ],
};
