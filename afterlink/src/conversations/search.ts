import { Conversation, adk, z, context } from "@botpress/runtime";
import { articlesTable } from "../tables/articles";

export default new Conversation({
  channel: "chat.channel",
  handler: async ({ message, conversation }) => {
    const logger = context.get("logger");

    if (message?.type !== "text") {
      return;
    }

    const text = message.payload.text;

    // Handle SEARCH requests
    if (text.startsWith("SEARCH:")) {
      const query = text.replace("SEARCH:", "").trim();
      logger.info("[search] Search query:", { query });

      await conversation.send({
        type: "text",
        payload: { text: "Searching..." },
      });

      try {
        // Fetch existing articles from table
        const { rows: existingArticles } = await articlesTable.findRows({});
        logger.info("[search] Found existing articles:", existingArticles.length);
        existingArticles.forEach(a => logger.info(`  - ID: ${a.id}, Title: "${a.title}"`));

        let relevantExisting: Array<{ id: number; title: string; snippet: string }> = [];

        // If we have existing articles, ask AI which are relevant
        if (existingArticles.length > 0) {
          const existingList = existingArticles.map((a) => ({
            id: a.id,
            title: a.title,
            snippet: a.snippet,
          }));

          const relevanceCheck = await adk.zai.text(
            `Given the search query "${query}", which of these existing articles are relevant?
             Return a JSON array of IDs that are relevant (can be empty if none match).
             Each ID should appear only ONCE - no duplicates.

             Existing articles:
             ${JSON.stringify(existingList, null, 2)}

             Return ONLY a JSON array of unique numbers, like [1, 3] or []. No other text.`,
            { length: 100 }
          );

          logger.info("[search] Relevance check result:", relevanceCheck);

          try {
            const parsedIds = JSON.parse(relevanceCheck) as number[];
            // Deduplicate IDs
            const relevantIds = [...new Set(parsedIds)];
            logger.info("[search] Deduplicated relevant IDs:", relevantIds);

            relevantExisting = existingList.filter((a) => relevantIds.includes(a.id));
            logger.info("[search] Relevant existing articles:", relevantExisting.length);
          } catch {
            logger.info("[search] Could not parse relevance check, skipping existing articles");
          }
        }

        // Calculate how many new suggestions we need
        const newCount = Math.max(0, 3 - relevantExisting.length);
        let newSuggestions: Array<{ title: string; snippet: string }> = [];

        if (newCount > 0) {
          // Get existing titles to exclude
          const existingTitles = existingArticles.map(a => a.title);

          const newSuggestionsJson = await adk.zai.text(
            `Generate a JSON array with exactly ${newCount} NEW article suggestions relevant to "${query}".
             Each article should have: title, snippet (brief description).

             IMPORTANT: Do NOT use any of these existing titles: ${JSON.stringify(existingTitles)}
             Generate completely NEW and DIFFERENT article ideas.

             Return ONLY valid JSON, no other text.
             Example: [{"title":"...", "snippet":"..."}]`,
            { length: 400 }
          );

          try {
            newSuggestions = JSON.parse(newSuggestionsJson);
            logger.info("[search] Generated new suggestions:", newSuggestions.length);
          } catch {
            logger.error("[search] Could not parse new suggestions");
          }
        }

        // Combine results: existing articles have id, new ones don't
        const results = [
          ...relevantExisting.map((a) => ({ id: a.id, title: a.title, snippet: a.snippet })),
          ...newSuggestions.map((a) => ({ title: a.title, snippet: a.snippet })),
        ];

        // DEBUG: Include diagnostic info
        const debug = {
          existingCount: existingArticles.length,
          existingIds: existingArticles.map(a => a.id),
          relevantExistingCount: relevantExisting.length,
          relevantExistingIds: relevantExisting.map(a => a.id),
          newSuggestionsCount: newSuggestions.length,
          finalResultsCount: results.length,
          finalResultsIds: results.map(r => r.id ?? 'none'),
        };

        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ results, debug }) },
        });
      } catch (error) {
        logger.error("[search] Error:", error);
        await conversation.send({
          type: "text",
          payload: { text: `Error: ${error instanceof Error ? error.message : String(error)}` },
        });
      }
      return;
    }

    // Handle ARTICLE requests (generate new article)
    if (text.startsWith("ARTICLE:")) {
      const title = text.replace("ARTICLE:", "").trim();
      logger.info("[search] Article request:", title);

      await conversation.send({
        type: "text",
        payload: { text: "Generating article..." },
      });

      try {
        // Generate the article content
        const articleContent = await adk.zai.text(
          `Write a short, informative article (3-4 paragraphs) about: "${title}".
           Write in a professional, engaging style similar to Medium articles.
           Do not include the title in your response, just the article body.
           Separate paragraphs with double newlines.`,
          { length: 800 }
        );

        // Generate a snippet
        const snippet = await adk.zai.text(
          `Write a one-sentence summary (max 150 chars) for an article titled "${title}".
           Return only the summary, no quotes or extra text.`,
          { length: 50 }
        );

        // Create slug from title
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        // Save to table
        const { rows } = await articlesTable.createRows({
          rows: [{
            title,
            slug,
            snippet: snippet.trim(),
            content: articleContent,
          }],
        });

        const savedRow = rows[0];
        logger.info("[search] Saved article with id:", savedRow?.id);

        // Return content with the article ID
        await conversation.send({
          type: "text",
          payload: {
            text: JSON.stringify({
              id: savedRow?.id,
              content: articleContent,
            }),
          },
        });
      } catch (error) {
        logger.error("[search] Error:", error);
        await conversation.send({
          type: "text",
          payload: { text: `Error: ${error instanceof Error ? error.message : String(error)}` },
        });
      }
      return;
    }

    // Handle GET_ARTICLE requests (fetch existing article by ID)
    if (text.startsWith("GET_ARTICLE:")) {
      const idStr = text.replace("GET_ARTICLE:", "").trim();
      const id = parseInt(idStr, 10);
      logger.info("[search] Get article request, id:", id);

      try {
        const { rows } = await articlesTable.findRows({
          filter: { id: { $eq: id } },
        });

        const row = rows[0];
        if (!row) {
          await conversation.send({
            type: "text",
            payload: { text: JSON.stringify({ error: "Article not found" }) },
          });
          return;
        }

        await conversation.send({
          type: "text",
          payload: {
            text: JSON.stringify({
              id: row.id,
              title: row.title,
              content: row.content,
            }),
          },
        });
      } catch (error) {
        logger.error("[search] Error:", error);
        await conversation.send({
          type: "text",
          payload: { text: `Error: ${error instanceof Error ? error.message : String(error)}` },
        });
      }
      return;
    }

    // Handle CLEAR_ARTICLES request (for debugging)
    if (text === "CLEAR_ARTICLES") {
      try {
        await articlesTable.deleteAllRows();
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ success: true, message: "All articles deleted" }) },
        });
      } catch (error) {
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ success: false, error: String(error) }) },
        });
      }
      return;
    }

    // Default response
    await conversation.send({
      type: "text",
      payload: { text: "Unknown request type. Use SEARCH:, ARTICLE:, or GET_ARTICLE: prefix." },
    });
  },
});
