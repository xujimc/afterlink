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
    console.log("[search] Handler triggered!");

    if (message?.type !== "text") {
      return;
    }

    const query = message.payload.text;
    console.log("[search] Query:", query);

    await conversation.send({
      type: "text",
      payload: { text: "Searching..." },
    });

    try {
      // Use zai.text() to generate, then parse as JSON
      const generatedText = await adk.zai.text(
        `Generate a JSON array with exactly 3 article search results relevant to "${query}".
         Each article should have: title, url, snippet.
         Return ONLY valid JSON, no other text.
         Example format: [{"title":"...", "url":"https://...", "snippet":"..."}]`,
        { length: 500 }
      );

      console.log("[search] Generated text:", generatedText);

      // Parse the JSON
      const articles = JSON.parse(generatedText);
      console.log("[search] Parsed articles:", articles);

      await conversation.send({
        type: "text",
        payload: { text: JSON.stringify(articles, null, 2) },
      });
    } catch (error) {
      console.error("[search] Error:", error);
      await conversation.send({
        type: "text",
        payload: {
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    }
  },
});
