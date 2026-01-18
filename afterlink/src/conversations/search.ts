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

        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify(results) },
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
        // Generate the article content with naturally embedded reader questions
        const articleContent = await adk.zai.text(
          `Write a short, captivating article (3-4 paragraphs) about: "${title}".
           Do not include the title in your response, just the article body.
           Separate paragraphs with double newlines.
           Keep it concise - around 250 words.

           WRITING STYLE - Use these techniques to hook and keep readers:

           1. OPENING HOOK: Start with ONE of these:
              - A surprising statistic or fact
              - A bold, contrarian statement
              - A "what if" scenario
              - A relatable problem or frustration

           2. CONVERSATIONAL TONE:
              - Write like you're talking to a smart friend
              - Use "you" and "your" frequently
              - Short punchy sentences mixed with longer ones
              - Occasional one-word sentences for impact. Like this.

           3. KEEP THEM READING:
              - Drop hints about what's coming ("Here's where it gets interesting...")
              - Use contrast (old way vs new way, expectation vs reality)
              - Include specific numbers and details (not "many people" but "73% of users")
              - Challenge common assumptions

           4. POWER WORDS: Use emotional language - "surprising", "secret", "mistake", "actually", "hidden", "finally"

           EMBEDDED QUESTIONS: Embed 2-3 reader questions using: {{Q:question here}}

           CRITICAL RULES FOR QUESTIONS:

           1. QUESTIONS MUST REQUIRE PERSONAL CONTEXT TO ANSWER
              The article cannot answer these because it doesn't know the reader's:
              - Age, health conditions, skin type, body type
              - Budget, financial situation
              - Schedule, lifestyle, living situation
              - Experience level, skill level
              - Personal goals, preferences
              - Location, climate, environment

           2. THE ARTICLE MUST NOT ANSWER THE QUESTION
              Do NOT place a question if the next sentence answers it.
              The question should remain OPEN - only answerable through personalized conversation.

           BADExample (article answers the question):
              "Retinol is powerful. {{Q:Is it safe for my age?}} Generally, anyone over 25 can use it safely."
              ❌ The next sentence answers the question!

           GOOD Examples (requires personal context, not answered):
              "Retinol speeds up cell turnover dramatically. {{Q:But is my skin ready for something this strong?}} The results can be transformative when used correctly."
              ✓ Article continues without answering - only the reader knows their skin's condition.

              "High-intensity training burns 3x more calories. {{Q:Could this be too intense for my fitness level?}} Many athletes swear by this method."
              ✓ Only the reader knows their fitness level.

              "Premium ingredients cost significantly more. {{Q:Is it worth it for my budget right now?}} The difference in quality is noticeable."
              ✓ Only the reader knows their financial situation.

           Questions MUST:
           - Require the reader's PERSONAL circumstances to answer
           - Use FIRST PERSON ("I", "my", "me")
           - Start with: "But is my...", "Should I with my...", "What if my...", "Could this work for my...", "Is my... ready for..."
           - NOT be answerable by general information in the article`,
          { length: 700 }
        );

        // Generate a snippet (remove any markers from snippet source)
        const cleanContentForSnippet = articleContent.replace(/\{\{Q:([^}]+)\}\}/g, '$1');
        const snippet = await adk.zai.text(
          `Write a one-sentence summary (max 150 chars) for an article titled "${title}".
           Return only the summary, no quotes or extra text.`,
          { length: 50 }
        );

        // Create slug from title
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        // Save to table (content includes {{Q:...}} markers)
        const { rows } = await articlesTable.createRows({
          rows: [{
            title,
            slug,
            snippet: snippet.trim(),
            content: articleContent,
            questions: "[]", // Questions are now embedded in content
          }],
        });

        const savedRow = rows[0];
        logger.info("[search] Saved article with id:", savedRow?.id);

        // Return content with embedded question markers
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

    // Handle ARTICLE_QUESTION requests (chat about article questions)
    if (text.startsWith("ARTICLE_QUESTION:")) {
      const jsonStr = text.replace("ARTICLE_QUESTION:", "").trim();

      try {
        const { articleTitle, articleContent, question } = JSON.parse(jsonStr) as {
          articleTitle: string;
          articleContent: string;
          question: string;
        };

        // Generate a response based on the article context and question
        const response = await adk.zai.text(
          `You are a helpful assistant discussing an article with a reader.

           Article Title: "${articleTitle}"

           Article Content:
           ${articleContent}

           The reader is asking: "${question}"

           Provide a helpful, informative response that:
           - Directly addresses their question
           - Uses information from the article when relevant
           - Adds additional context or insights if helpful
           - Is conversational and engaging
           - Is concise (2-3 paragraphs max)

           Respond naturally as if having a conversation.`,
          { length: 400 }
        );

        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ response }) },
        });
      } catch (error) {
        logger.error("[search] Error in ARTICLE_QUESTION:", error);
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ error: "Failed to generate response" }) },
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
