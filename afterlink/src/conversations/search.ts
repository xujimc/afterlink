import { Conversation, adk, z, context } from "@botpress/runtime";
import { articlesTable } from "../tables/articles";
import { articleContentTable } from "../tables/articleContent";
import { userInsightsTable } from "../tables/userInsights";

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
          `Write an article (5-7 paragraphs, 500-600 words) about: "${title}".

           CRITICAL FORMAT REQUIREMENT:
           You MUST embed exactly 2-3 questions using this exact format: {{Q:question text here}}
           Example: "This technique works fast. {{Q:But would it work for my situation?}} The results speak for themselves."

           BEFORE WRITING:
           Think of 2-3 personal questions a reader might have about "${title}" that depend on their:
           age, budget, health, experience level, lifestyle, or goals.

           QUESTION RULES:
           - Questions must use first person ("I", "my", "me")
           - Questions must require personal context to answer
           - The article must NOT answer the question in the following sentence
           - Format: {{Q:But is my... / Should I with my... / Could this work for my...}}

           WRITING STYLE:
           - Conversational tone, like talking to a smart friend
           - Start with a hook (surprising fact, bold statement, or relatable problem)
           - Use "you" and "your" frequently
           - Mix short punchy sentences with longer ones

           Do not include the title. Separate paragraphs with double newlines.`,
          { length: 1500 }
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

        // Save metadata to articlesTable
        const { rows } = await articlesTable.createRows({
          rows: [{
            title,
            slug,
            snippet: snippet.trim(),
          }],
        });

        const savedRow = rows[0];
        const articleId = savedRow?.id;

        if (!articleId) {
          throw new Error("Failed to save article metadata");
        }

        // Save content to articleContentTable (separate to avoid 4KB limit)
        await articleContentTable.createRows({
          rows: [{
            articleId,
            content: articleContent,
          }],
        });

        logger.info("[search] Saved article with id:", articleId);

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
        // Fetch metadata from articlesTable
        const { rows: metadataRows } = await articlesTable.findRows({
          filter: { id: { $eq: id } } as any,
        });

        const metadata = metadataRows[0];
        if (!metadata) {
          await conversation.send({
            type: "text",
            payload: { text: JSON.stringify({ error: "Article not found" }) },
          });
          return;
        }

        // Fetch content from articleContentTable
        const { rows: contentRows } = await articleContentTable.findRows({
          filter: { articleId: { $eq: id } },
        });

        const contentRow = contentRows[0];
        const content = contentRow?.content || "";

        await conversation.send({
          type: "text",
          payload: {
            text: JSON.stringify({
              id: metadata.id,
              title: metadata.title,
              content,
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
        const {
          articleTitle,
          articleContent,
          question,
          conversationHistory,
          userId,
          isFirstMessage,
        } = JSON.parse(jsonStr) as {
          articleTitle: string;
          articleContent: string;
          question: string;
          conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
          userId: string;
          isFirstMessage: boolean;
        };

        logger.info("[chat] Article question received", { userId, isFirstMessage, question });

        let response: string;

        if (isFirstMessage) {
          // FIRST MESSAGE: Don't answer directly, ask for personal info
          response = await adk.zai.text(
            `You are a friendly, helpful assistant. A reader just clicked on a question while reading an article.

             Article: "${articleTitle}"
             Their question: "${question}"

             IMPORTANT: Do NOT answer the question directly. Instead:
             1. Acknowledge their question warmly
             2. Explain that the answer really depends on their personal situation
             3. Ask ONE specific, friendly follow-up question to understand their situation better

             Examples of follow-up questions you might ask:
             - "What's your current experience level with this?"
             - "Are you working within a specific budget?"
             - "Do you have any particular concerns or constraints?"

             Keep it conversational and genuinely curious - you want to help them get the most relevant answer.
             Be warm and helpful, not interrogating. 2-3 sentences max.`,
            { length: 200 }
          );
        } else {
          // FOLLOW-UP MESSAGE: Extract insights, then respond helpfully

          // Step 1: Extract any personal insights from the user's message
          const extractionResult = await adk.zai.text(
            `Analyze this message from a user and extract any personal information they revealed.

             User message: "${question}"

             Extract insights in this JSON format (return empty array if no insights found):
             [{"category": "budget|age|goal|concern|lifestyle|preference|experience|timeline|health|location", "insight": "the specific info"}]

             Examples:
             - "I'm 45 and worried about aging" → [{"category": "age", "insight": "45 years old"}, {"category": "concern", "insight": "worried about aging"}]
             - "I spend about $200 a month" → [{"category": "budget", "insight": "$200 per month"}]
             - "I have oily skin" → [{"category": "health", "insight": "oily skin"}]
             - "Just asking out of curiosity" → []

             Return ONLY the JSON array, nothing else.`,
            { length: 200 }
          );

          // Save extracted insights
          try {
            const insights = JSON.parse(extractionResult) as Array<{ category: string; insight: string }>;
            if (insights.length > 0) {
              logger.info("[chat] Extracted insights:", insights);
              for (const insight of insights) {
                await userInsightsTable.createRows({
                  rows: [{
                    oduserId: userId,
                    articleTitle,
                    category: insight.category,
                    insight: insight.insight,
                    rawMessage: question,
                  }],
                });
              }
              logger.info("[chat] Saved insights to table");
            }
          } catch {
            logger.info("[chat] No insights extracted or failed to parse");
          }

          // Step 2: Generate helpful response that also probes for more info
          const historyText = conversationHistory
            .map((m) => `${m.role === "user" ? "Reader" : "Assistant"}: ${m.content}`)
            .join("\n");

          response = await adk.zai.text(
            `You are a friendly, helpful assistant discussing an article with a reader.

             Article: "${articleTitle}"

             Conversation so far:
             ${historyText}

             Reader's latest message: "${question}"

             Respond helpfully:
             1. Address what they said/asked with genuinely useful information
             2. Be warm and conversational
             3. Naturally weave in ONE follow-up question to learn more about them
                (their goals, preferences, situation, experience, budget, timeline, etc.)
             4. The follow-up should feel natural, not forced - like you're genuinely curious to help them better

             Keep it concise (2-3 sentences). Don't be pushy or interrogating.`,
            { length: 300 }
          );
        }

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
        await articleContentTable.deleteAllRows();
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
