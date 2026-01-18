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

      // Check if query is comprehensible
      if (query.length < 2) {
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify([]) },
        });
        return;
      }

      await conversation.send({
        type: "text",
        payload: { text: "Searching..." },
      });

      try {
        // Validate if the query is a meaningful search term
        const validationResult = await adk.zai.text(
          `Is this a comprehensible search query that someone might use to find articles or information?
           Query: "${query}"

           Answer with ONLY "yes" or "no". Nothing else.`,
          { length: 10 }
        );

        const isValid = validationResult.trim().toLowerCase().startsWith("yes");
        logger.info("[search] Query validation:", { query, isValid, validationResult });

        if (!isValid) {
          // Easter egg: suggest mental health article for gibberish
          await conversation.send({
            type: "text",
            payload: { text: JSON.stringify([
              { title: "Signs You Might Need a Mental Health Day", snippet: "Feeling overwhelmed? Here's how to recognize when your mind needs a break." }
            ]) },
          });
          return;
        }
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
            // Clean up common AI response issues
            let cleanJson = relevanceCheck.trim();
            cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
            const arrayMatch = cleanJson.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              cleanJson = arrayMatch[0];
            }
            const parsedIds = JSON.parse(cleanJson) as number[];
            // Deduplicate IDs
            const relevantIds = [...new Set(parsedIds)];
            logger.info("[search] Deduplicated relevant IDs:", relevantIds);

            relevantExisting = existingList.filter((a) => relevantIds.includes(a.id));
            logger.info("[search] Relevant existing articles:", relevantExisting.length);
          } catch {
            logger.info("[search] Could not parse relevance check, skipping existing articles");
          }
        }

        // Calculate how many new suggestions we need (up to 10 total results)
        const newCount = Math.max(0, 10 - relevantExisting.length);
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
            { length: 1200 }
          );

          try {
            // Clean up common AI response issues (markdown code blocks, extra text)
            let cleanJson = newSuggestionsJson.trim();
            // Remove markdown code blocks
            cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
            // Try to extract JSON array if there's extra text
            const arrayMatch = cleanJson.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              cleanJson = arrayMatch[0];
            }
            newSuggestions = JSON.parse(cleanJson);
            logger.info("[search] Generated new suggestions:", newSuggestions.length);
          } catch (e) {
            logger.error("[search] Could not parse new suggestions:", newSuggestionsJson);
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

        EMBEDDED QUESTIONS - THE KEY CONCEPT:
        Given the title, create 2-5 questions using {{Q:question text}} format.
        These questions are NOT random - they are points where a reader would naturally think:
        "This is interesting, but what about MY specific situation?"
        Write the rest of the article around these questions, but don't make it obvious that the questions are important.

        The question EXTENDS or SPECIFIES the content that came just before it.

        QUESTION RULES:
        - Questions must DIRECTLY relate to the sentences before them
        - Questions ask for PERSONALIZATION SPECIFICATION of the general info just presented
        - Use first person ("I", "my", "me")
        - The article must NOT answer the question afterward
        - Format: {{Q:question here}}

        EXAMPLES OF GOOD QUESTIONS PLACEMENT:
        - Content: "This approach works best with consistent practice." → {{Q:What if my schedule doesn't allow daily practice?}} because then we can naturally ask about their daily practice
        - Content: "The average cost runs $50-100 per month." → {{Q:Is there an option that fits my budget?}} because then we can naturally ask about their budget
        - Content: "Studies show this is most effective for beginners." → {{Q:Would this still work given my experience level?}} because then we can naturall ask about their experience level

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
          paragraphContext,
          question,
          conversationHistory,
          userId,
          isFirstMessage,
          contactInfo,
        } = JSON.parse(jsonStr) as {
          articleTitle: string;
          paragraphContext: string;
          question: string;
          conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
          userId: string;
          isFirstMessage: boolean;
          contactInfo?: { userName: string; contactPreference: "email" | "phone"; contactValue: string };
        };

        logger.info("[chat] Article question received", { userId, isFirstMessage, question });

        // Fetch insights from THIS SESSION only (same article page load)
        let sessionMemory = "";
        try {
          const { rows: sessionInsights } = await userInsightsTable.findRows({
            filter: { oduserId: { $eq: userId } },
          });
          if (sessionInsights.length > 0) {
            const insightsSummary = sessionInsights
              .map((i) => `- ${i.category}: ${i.insight}`)
              .join("\n");
            sessionMemory = `\n\nWHAT THE USER HAS SHARED IN THIS SESSION:\n${insightsSummary}\n\nUse this to personalize your response. Don't ask about things they already told you.`;
            logger.info("[chat] Loaded session memory:", sessionInsights.length, "insights");
          }
        } catch (e) {
          logger.info("[chat] Could not load session insights");
        }

        let response: string;

        if (isFirstMessage) {
          // FIRST MESSAGE: Don't answer directly, ask for the specific info hinted by the question
          response = await adk.zai.text(
            `You are a friendly, helpful assistant. A reader clicked on a question while reading an article.

             Article: "${articleTitle}"

             The paragraph they were reading:
             "${paragraphContext}"

             The question they clicked: "${question}"
             Session memory: ${sessionMemory}

             CRITICAL INSIGHT: The question they clicked REVEALS what personal information they're open to sharing.
             Examples:
             - "What fits my budget?" → They want to talk about their BUDGET. Ask about their budget.
             - "Would this work for my age?" → They want to talk about their AGE. Ask about their age.
             - "Is this right for my skin type?" → They want to talk about their SKIN/HEALTH. Ask about that.
             - "What's best for my goals?" → They want to talk about their GOALS. Ask about their goals.

             YOUR TASK:
             1. Quickly explain that to give them a truly helpful answer, you need to know more about the SPECIFIC topic their question mentions
             2. Ask them directly about that topic (the one THEY brought up in their question)

             STRICT RULES:
             - ONLY ask about what their question implies (budget→budget, age→age, goals→goals, etc.)
             - Do NOT ask about unrelated personal details
             - Do NOT answer the question yet
             - Keep it conversational, 2-3 sentences max`,
            { length: 200 }
          );
        } else {
          // FOLLOW-UP MESSAGE: Extract insights, then respond helpfully

          // Step 1: Fetch existing notes for this session to combine with new info
          let existingNote = "";
          let existingRowId: number | null = null;
          try {
            const { rows: existingRows } = await userInsightsTable.findRows({
              filter: { oduserId: { $eq: userId } },
            });
            if (existingRows.length > 0) {
              existingNote = existingRows[0].insight || "";
              existingRowId = existingRows[0].id;
              logger.info("[chat] Found existing note for session:", existingRowId);
            }
          } catch (e) {
            logger.info("[chat] Could not fetch existing notes");
          }

          // Step 2: Extract and combine lead qualification notes
          // Build full history of what the USER said (not the assistant)
          const userMessages = conversationHistory
            .filter((m) => m.role === "user")
            .map((m) => m.content);
          userMessages.push(question); // Add current message

          const extractionResult = await adk.zai.text(
            `You are helping a salesman prepare for outreach. Write a factual profile of this lead.

             EVERYTHING THE LEAD SAID:
             ${userMessages.map((msg, i) => `${i + 1}. "${msg}"`).join("\n")}

             ${existingNote ? `PREVIOUS NOTES:\n"${existingNote}"` : ""}

             STRICT RULES:
             - ONLY include facts the lead EXPLICITLY stated
             - DO NOT guess, infer, or assume anything
             - DO NOT estimate age, income, or any demographic unless they said it
             - If they said "I spend $5-8" write exactly that, don't add interpretations

             INTEREST vs CURIOSITY:
             - Asking questions is NOT interest, it's just curiosity. Do NOT note it.
             - ONLY note interest if they EXPLICITLY say:
               - "I want to..." / "I'd like to..." / "I'm interested in..."
               - "I plan to..." / "I'm going to..." / "I'm looking for..."
               - "I need..." / "I'm trying to..."
             - Questions like "How does X work?" or "What is Y?" = curiosity, NOT interest
             - Do NOT write "interested in X" unless they literally said they are interested

             Return JSON:
             {
               "theme": "food|beauty|fitness|tech|finance|health|education|travel|home|fashion|other",
               "note": "Only explicit facts and stated interests. No inferences from questions."
             }

             If they only asked questions without stating facts about themselves, return empty note.`,
            { length: 300 }
          );

          // Save or update lead qualification note
          try {
            let cleanJson = extractionResult.trim();
            cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

            const extracted = JSON.parse(cleanJson) as { theme: string; note: string };

            if (extracted.note && extracted.note.trim()) {
              logger.info("[chat] Extracted/combined lead note:", extracted);

              if (existingRowId) {
                // Update existing row with combined note
                await userInsightsTable.updateRows({
                  rows: [{
                    id: existingRowId,
                    category: extracted.theme || "other",
                    insight: extracted.note,
                    rawMessage: question, // Update to latest message
                  }],
                });
                logger.info("[chat] Updated existing lead note");
              } else {
                // Create new row with contact info if available
                await userInsightsTable.createRows({
                  rows: [{
                    oduserId: userId,
                    articleTitle,
                    category: extracted.theme || "other",
                    insight: extracted.note,
                    rawMessage: question,
                    userName: contactInfo?.userName,
                    contactPreference: contactInfo?.contactPreference,
                    userEmail: contactInfo?.contactPreference === "email" ? contactInfo?.contactValue : undefined,
                    userPhone: contactInfo?.contactPreference === "phone" ? contactInfo?.contactValue : undefined,
                  }],
                });
                logger.info("[chat] Created new lead note with contact info");
              }
            }
          } catch (e) {
            logger.info("[chat] No lead note extracted or failed to parse:", extractionResult);
          }

          // Step 2: Generate helpful response
          const historyText = conversationHistory
            .map((m) => `${m.role === "user" ? "Reader" : "Assistant"}: ${m.content}`)
            .join("\n");

          // Get the original question (first user message in history)
          const originalQuestion = conversationHistory.length > 0
            ? conversationHistory[0].content
            : question;

          response = await adk.zai.text(
            `You are a friendly, helpful assistant discussing an article with a reader.

             Article: "${articleTitle}"

             The paragraph they were reading:
             "${paragraphContext}"

             Original question they clicked: "${originalQuestion}"${sessionMemory}

             Conversation so far:
             ${historyText}

             Reader's latest message: "${question}"

             YOUR TASK: Simply answer or respond to what they said. Be helpful and warm.
             Use the paragraph context and what they've shared in this session to give relevant, personalized answers.

             STRICT RULES:
             - Do NOT ask follow-up questions unless the user EXPLICITLY asked you something you cannot answer
             - Do NOT introduce new topics
             - Do NOT probe for more information
             - Just respond to what they said, then stop

             Keep it concise (2-3 sentences). No questions at the end.`,
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

    // Handle GET_INSIGHTS request (for business dashboard)
    if (text === "GET_INSIGHTS") {
      try {
        let { rows } = await userInsightsTable.findRows({});

        // Auto-seed mock data if database is empty (one-time)
        if (rows.length === 0) {
          const mockLeads = [
            {
              oduserId: "mock_lead_1",
              articleTitle: "Best Bubble Tea Spots in the City",
              category: "food",
              insight: "Spends $5-8 per bubble tea. Visits 2-3 times per week. Prefers less sugar (30-50%). Likes taro and brown sugar flavors.",
              rawMessage: "",
            },
            {
              oduserId: "mock_lead_2",
              articleTitle: "Skincare Routine for Your 30s",
              category: "beauty",
              insight: "32 years old. Has combination skin - oily T-zone, dry cheeks. Currently spends $150/month on skincare. Looking for anti-aging products. Concerned about fine lines.",
              rawMessage: "",
            },
            {
              oduserId: "mock_lead_3",
              articleTitle: "Home Workout Equipment Guide",
              category: "fitness",
              insight: "Works out 4x per week at home. Budget of $500 for equipment. Has limited space (apartment). Interested in strength training. Already owns dumbbells.",
              rawMessage: "",
            },
            {
              oduserId: "mock_lead_4",
              articleTitle: "Investing for Beginners",
              category: "finance",
              insight: "25 years old. Just started first job. Has $1000 to invest. Risk-tolerant. Interested in index funds and ETFs. No debt.",
              rawMessage: "",
            },
            {
              oduserId: "mock_lead_5",
              articleTitle: "Best Coffee Machines for Home",
              category: "food",
              insight: "Drinks 3 cups of coffee daily. Currently spending $15/day at cafes. Budget up to $800 for a machine. Prefers espresso-based drinks. Has counter space.",
              rawMessage: "",
            },
            {
              oduserId: "mock_lead_6",
              articleTitle: "Learning Piano as an Adult",
              category: "education",
              insight: "45 years old. Complete beginner. Can practice 30 min daily. Interested in digital piano under $1000. Wants to play classical music.",
              rawMessage: "",
            },
            {
              oduserId: "mock_lead_7",
              articleTitle: "Sustainable Fashion Guide",
              category: "fashion",
              insight: "28 years old. Trying to build capsule wardrobe. Budget $200/month for clothes. Prefers neutral colors. Size medium. Works in casual office.",
              rawMessage: "",
            },
          ];
          await userInsightsTable.createRows({ rows: mockLeads });
          logger.info("[search] Auto-seeded mock data");
          const result = await userInsightsTable.findRows({});
          rows = result.rows;
        }

        logger.info("[search] Fetched insights:", rows.length);

        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ insights: rows }) },
        });
      } catch (error) {
        logger.error("[search] Error fetching insights:", error);
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ error: "Failed to fetch insights" }) },
        });
      }
      return;
    }

    // Handle SEED_MOCK_DATA request (for testing)
    if (text === "SEED_MOCK_DATA") {
      try {
        const mockLeads = [
          {
            oduserId: "mock_lead_1",
            articleTitle: "Best Bubble Tea Spots in the City",
            category: "food",
            insight: "Spends $5-8 per bubble tea. Visits 2-3 times per week. Prefers less sugar (30-50%). Likes taro and brown sugar flavors.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_2",
            articleTitle: "Skincare Routine for Your 30s",
            category: "beauty",
            insight: "32 years old. Has combination skin - oily T-zone, dry cheeks. Currently spends $150/month on skincare. Looking for anti-aging products. Concerned about fine lines.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_3",
            articleTitle: "Home Workout Equipment Guide",
            category: "fitness",
            insight: "Works out 4x per week at home. Budget of $500 for equipment. Has limited space (apartment). Interested in strength training. Already owns dumbbells.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_4",
            articleTitle: "Investing for Beginners",
            category: "finance",
            insight: "25 years old. Just started first job. Has $1000 to invest. Risk-tolerant. Interested in index funds and ETFs. No debt.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_5",
            articleTitle: "Best Coffee Machines for Home",
            category: "food",
            insight: "Drinks 3 cups of coffee daily. Currently spending $15/day at cafes. Budget up to $800 for a machine. Prefers espresso-based drinks. Has counter space.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_6",
            articleTitle: "Learning Piano as an Adult",
            category: "education",
            insight: "45 years old. Complete beginner. Can practice 30 min daily. Interested in digital piano under $1000. Wants to play classical music.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_7",
            articleTitle: "Sustainable Fashion Guide",
            category: "fashion",
            insight: "28 years old. Trying to build capsule wardrobe. Budget $200/month for clothes. Prefers neutral colors. Size medium. Works in casual office.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_8",
            articleTitle: "Best Noise-Canceling Headphones",
            category: "tech",
            insight: "Software developer. Works from home. Struggling with noise from neighbors. Currently using $30 earbuds. Willing to spend up to $400 for quality headphones. Prefers over-ear style.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_9",
            articleTitle: "Beginner's Guide to Meditation",
            category: "health",
            insight: "Feels stressed and anxious lately. Has trouble sleeping. Never tried meditation before. Looking for guided meditation apps. Willing to pay for premium subscription.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_10",
            articleTitle: "Best Dog Food Brands",
            category: "other",
            insight: "Has a 3-year-old golden retriever. Dog has sensitive stomach. Currently spending $80/month on dog food. Looking for grain-free options. Concerned about dog's coat health.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_11",
            articleTitle: "Kitchen Renovation Ideas",
            category: "home",
            insight: "Homeowner. Kitchen is 20 years old. Budget of $15,000-20,000 for renovation. Want modern appliances. Planning to start in 3 months.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_12",
            articleTitle: "Best Strollers for Newborns",
            category: "other",
            insight: "Expecting first baby in 2 months. Researching strollers. Budget around $500. Live in city, need something compact. Partner prefers jogging stroller.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_13",
            articleTitle: "Gaming PC Build Guide",
            category: "tech",
            insight: "Plays games 3-4 hours daily. Current laptop is 5 years old and slow. Budget $1500 for new gaming PC. Interested in streaming on Twitch. Plays mostly FPS games.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_14",
            articleTitle: "Meal Prep for Busy Professionals",
            category: "food",
            insight: "Works 60 hours per week. Eating too much takeout. Wants to meal prep on Sundays. Budget $100/week for groceries. Trying to lose weight. Needs quick recipes under 30 minutes.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_15",
            articleTitle: "Electric Vehicle Buying Guide",
            category: "other",
            insight: "Current car is 10 years old. Commutes 40 miles daily. Interested in Tesla Model 3 or similar. Budget $45,000. Has home charging capability. Concerned about range anxiety.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_16",
            articleTitle: "Photography for Beginners",
            category: "other",
            insight: "Just bought first DSLR camera. Complete beginner. Want to photograph landscapes and portraits. Considering photography classes. Budget $200 for first lens.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_17",
            articleTitle: "Wine Tasting for Beginners",
            category: "food",
            insight: "Enjoys wine but knows nothing about it. Wants to impress at dinner parties. Prefers red wine. Spends $15-25 per bottle currently. Interested in wine club subscription.",
            rawMessage: "",
          },
          {
            oduserId: "mock_lead_18",
            articleTitle: "Remote Work Productivity Tips",
            category: "tech",
            insight: "Been working remotely for 2 years. Struggling with work-life balance. Home office is cramped. Looking for ergonomic chair under $500. Considering standing desk.",
            rawMessage: "",
          },
        ];

        await userInsightsTable.createRows({ rows: mockLeads });
        logger.info("[search] Seeded mock data:", mockLeads.length);

        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ success: true, message: `Seeded ${mockLeads.length} mock leads` }) },
        });
      } catch (error) {
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ success: false, error: String(error) }) },
        });
      }
      return;
    }

    // Handle MATCH_ICP request (score leads against ICP)
    // Uses B2C lead scoring: Fit, Budget, Need, Urgency, Engagement
    if (text.startsWith("MATCH_ICP:")) {
      const jsonStr = text.replace("MATCH_ICP:", "").trim();

      try {
        const { icpDescription, leads } = JSON.parse(jsonStr) as {
          icpDescription: string;
          leads: Array<{ oduserId: string; insight: string }>;
        };

        logger.info("[search] Matching ICP against", leads.length, "leads");

        // Score each lead across 5 B2C dimensions
        const scores: Array<{
          oduserId: string;
          score: number;
          reason: string;
          breakdown: {
            fit: { points: number; max: number; detail: string };
            budget: { points: number; max: number; detail: string };
            need: { points: number; max: number; detail: string };
            urgency: { points: number; max: number; detail: string };
            engagement: { points: number; max: number; detail: string };
          };
        }> = [];

        for (const lead of leads) {
          // Single LLM call to score all 5 dimensions
          const scoringResult = await adk.zai.text(
            `You are scoring a lead against an Ideal Customer Profile (ICP).

ICP DESCRIPTION:
"${icpDescription}"

LEAD PROFILE:
"${lead.insight}"

STEP 1: UNDERSTAND THE ICP
First, identify what the ICP is really about:
- What domain/category? (beauty, food, fitness, finance, tech, etc.)
- What underlying concerns or desires? (aging, health, saving money, convenience, etc.)
- What type of person? (high spender, budget-conscious, beginners, experts, etc.)

STEP 2: UNDERSTAND THE LEAD
Then, identify what the lead has shared:
- What domain are they in?
- What are their underlying concerns or motivations?
- What type of person are they based on their behavior?

STEP 3: SCORE EACH DIMENSION
Think CONCEPTUALLY, not literally. Words don't need to match exactly.
Someone who cares about "fine lines" also cares about aging, appearance, skin health, and looking younger.
Someone who likes "bubble tea" also likes sweet drinks, treats, and beverages.

DIMENSIONS:

1. FIT (0-100): Conceptual overlap between lead's world and ICP's world
   - Think about the underlying domain, not surface words
   - Are they in the same category of life/interests?
   - Would a product for the ICP plausibly interest this lead?
   - 0 = completely different worlds (piano enthusiast vs sweet beverages)
   - 100 = perfect domain match

2. BUDGET (0-100): Does their spending match what ICP expects?
   - Compare their stated spending to what the ICP implies
   - High-spender ICP + high-spending lead = high score
   - Budget-friendly ICP + budget-conscious lead = high score
   - Mismatch (high-spender ICP + cheap lead) = low score
   - 0 = no spending information mentioned

3. NEED (0-100): Do they have a problem/desire the ICP addresses?
   - Look for concerns, complaints, goals, or desires
   - "Concerned about X", "want to Y", "looking for Z" = need exists
   - The need must be relevant to what ICP is solving
   - 0 = no problems or desires expressed, just neutral descriptions

4. URGENCY (0-100): Are they actively seeking a solution?
   - "Looking for", "need", "planning to", "want to try" = high urgency
   - "Interested in", "curious about" = medium urgency
   - Just describing habits or preferences = low/no urgency
   - 0 = no buying signals at all

5. ENGAGEMENT (0-100): How much useful detail did they share?
   - Specific numbers, frequencies, preferences = high
   - Some details = medium
   - Vague statements = low

SCORING RULES:
- Score based ONLY on what is explicitly stated
- 0 means the dimension has NO relevant information (not "unknown", just absent)
- Think conceptually about fit - related domains should score well
- Be generous with FIT if domains overlap, strict with other dimensions

Return JSON only:
{
  "fit": { "score": number, "detail": "one sentence explaining the conceptual connection or lack thereof" },
  "budget": { "score": number, "detail": "one sentence" },
  "need": { "score": number, "detail": "one sentence" },
  "urgency": { "score": number, "detail": "one sentence" },
  "engagement": { "score": number, "detail": "one sentence" }
}`,
            { length: 500 }
          );

          let resultClean = scoringResult.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
          const dimScores = JSON.parse(resultClean) as {
            fit: { score: number; detail: string };
            budget: { score: number; detail: string };
            need: { score: number; detail: string };
            urgency: { score: number; detail: string };
            engagement: { score: number; detail: string };
          };

          logger.info(`[search] Lead ${lead.oduserId} scores:`, JSON.stringify(dimScores));

          // Weights for each dimension (sum to 100)
          const weights = {
            fit: 35,        // Most important - do they match?
            budget: 20,     // Can they afford it?
            need: 20,       // Do they have a problem to solve?
            urgency: 15,    // Are they ready to buy?
            engagement: 10, // How much did they share?
          };

          // Calculate weighted points for each dimension
          const breakdown = {
            fit: {
              points: Math.round((dimScores.fit.score / 100) * weights.fit * 10) / 10,
              max: weights.fit,
              detail: dimScores.fit.detail,
            },
            budget: {
              points: Math.round((dimScores.budget.score / 100) * weights.budget * 10) / 10,
              max: weights.budget,
              detail: dimScores.budget.detail,
            },
            need: {
              points: Math.round((dimScores.need.score / 100) * weights.need * 10) / 10,
              max: weights.need,
              detail: dimScores.need.detail,
            },
            urgency: {
              points: Math.round((dimScores.urgency.score / 100) * weights.urgency * 10) / 10,
              max: weights.urgency,
              detail: dimScores.urgency.detail,
            },
            engagement: {
              points: Math.round((dimScores.engagement.score / 100) * weights.engagement * 10) / 10,
              max: weights.engagement,
              detail: dimScores.engagement.detail,
            },
          };

          // Calculate total score
          // Apply exponential curve to fit (most important dimension)
          // Low fit should crush the score
          const fitRaw = dimScores.fit.score / 100;
          const fitGate = Math.pow(fitRaw, 1.5); // Exponential penalty for low fit

          const rawTotal =
            breakdown.fit.points +
            breakdown.budget.points +
            breakdown.need.points +
            breakdown.urgency.points +
            breakdown.engagement.points;

          // Final score = raw total * fit gate
          // This means low fit crushes everything
          const totalScore = Math.round(rawTotal * fitGate);

          // Generate reason summary
          const strongPoints: string[] = [];
          const weakPoints: string[] = [];

          for (const [key, value] of Object.entries(breakdown)) {
            const ratio = value.points / value.max;
            if (ratio >= 0.7) strongPoints.push(key);
            else if (ratio <= 0.3) weakPoints.push(key);
          }

          let reason = "";
          if (strongPoints.length > 0) reason += `Strong: ${strongPoints.join(", ")}. `;
          if (weakPoints.length > 0) reason += `Weak: ${weakPoints.join(", ")}.`;
          if (!reason) reason = "Average match across criteria.";

          scores.push({
            oduserId: lead.oduserId,
            score: totalScore,
            reason: reason.trim(),
            breakdown,
          });
        }

        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);

        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ scores }) },
        });
      } catch (error) {
        logger.error("[search] Error matching ICP:", error);
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ error: "Failed to match ICP" }) },
        });
      }
      return;
    }

    // Handle SAVE_LEAD_CONTACT request (from article gate)
    if (text.startsWith("SAVE_LEAD_CONTACT:")) {
      const jsonStr = text.replace("SAVE_LEAD_CONTACT:", "").trim();

      try {
        const { oduserId, articleTitle, userName, contactPreference, contactValue } = JSON.parse(jsonStr) as {
          oduserId: string;
          articleTitle: string;
          userName: string;
          contactPreference: "email" | "phone";
          contactValue: string;
        };

        logger.info("[search] Saving lead contact:", { oduserId, userName, contactPreference });

        // Check if row exists for this user
        const { rows: existingRows } = await userInsightsTable.findRows({
          filter: { oduserId: { $eq: oduserId } },
        });

        if (existingRows.length > 0) {
          // Update existing row with contact info
          await userInsightsTable.updateRows({
            rows: [{
              id: existingRows[0].id,
              userName,
              contactPreference,
              userEmail: contactPreference === "email" ? contactValue : existingRows[0].userEmail,
              userPhone: contactPreference === "phone" ? contactValue : existingRows[0].userPhone,
            }],
          });
          logger.info("[search] Updated existing lead with contact info");
        } else {
          // Don't create row with only contact info - wait for actual insight data
          logger.info("[search] No existing lead found, contact info will be stored when user provides insight");
        }

        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ success: true }) },
        });
      } catch (error) {
        logger.error("[search] Error saving lead contact:", error);
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ success: false, error: String(error) }) },
        });
      }
      return;
    }

    // Handle CLEAR_ARTICLES request (for debugging)
    if (text === "CLEAR_ARTICLES") {
      try {
        await articlesTable.deleteAllRows();
        await articleContentTable.deleteAllRows();
        await userInsightsTable.deleteAllRows();
        await conversation.send({
          type: "text",
          payload: { text: JSON.stringify({ success: true, message: "All data cleared" }) },
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
