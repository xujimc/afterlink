import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "afterlink",
  description: "An AI agent built with Botpress ADK",

  defaultModels: {
    autonomous: "openai:gpt-4o-mini",
    zai: "openai:gpt-4o-mini",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  dependencies: {
    integrations: {
      chat: { version: "chat@0.7.4", enabled: true },
    },
  },
});
