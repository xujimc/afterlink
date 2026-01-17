import { Conversation, adk, z } from "@botpress/runtime";

const articlesSchema = z.array(
  z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
  })
);

export default new Conversation({
  channel: "chat.channel",
  handler: async ({ message, conversation }) => {
    if (message?.type !== "text") {
      return;
    }

    const text = message.payload.text;

    // Handle SEARCH requests
    if (text.startsWith("SEARCH:")) {
      const query = text.replace("SEARCH:", "").trim();
      console.log("[search] Search query:", query);

      await conversation.send({
        type: "text",
        payload: { text: "Searching..." },
      });

      try {
        const articlesJson = await adk.zai.text(
          `Generate a JSON array with exactly 3 article search results relevant to "${query}".
           Each article should have: title, url (use placeholder like /article/1), snippet.
           Return ONLY valid JSON, no other text.
           Example: [{"title":"...", "url":"/article/1", "snippet":"..."}]`,
          { length: 500 }
        );

        await conversation.send({
          type: "text",
          payload: { text: articlesJson },
        });
      } catch (error) {
        console.error("[search] Error:", error);
        await conversation.send({
          type: "text",
          payload: { text: `Error: ${error instanceof Error ? error.message : String(error)}` },
        });
      }
      return;
    }

    // Handle ARTICLE requests
    if (text.startsWith("ARTICLE:")) {
      const title = text.replace("ARTICLE:", "").trim();
      console.log("[search] Article request:", title);

      await conversation.send({
        type: "text",
        payload: { text: "Generating article..." },
      });

      try {
        const articleContent = await adk.zai.text(
          `Write a short, informative article (3-4 paragraphs) about: "${title}".
           Write in a professional, engaging style similar to Medium articles.
           Do not include the title in your response, just the article body.
           Separate paragraphs with double newlines.`,
          { length: 800 }
        );

        await conversation.send({
          type: "text",
          payload: { text: articleContent },
        });
      } catch (error) {
        console.error("[search] Error:", error);
        await conversation.send({
          type: "text",
          payload: { text: `Error: ${error instanceof Error ? error.message : String(error)}` },
        });
      }
      return;
    }

    // Default response for unknown requests
    await conversation.send({
      type: "text",
      payload: { text: "Unknown request type. Use SEARCH: or ARTICLE: prefix." },
    });
  },
});
