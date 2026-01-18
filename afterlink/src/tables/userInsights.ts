import { Table, z } from "@botpress/runtime";

export const userInsightsTable = new Table({
  name: "userInsightsTable",
  columns: {
    oduserId: z.string(),       // Unique identifier for the user
    articleTitle: z.string(),  // Which article they were reading
    category: z.string(),      // budget, age, goal, concern, lifestyle, preference, timeline, etc.
    insight: z.string(),       // The extracted value (e.g., "oily skin", "$200/month", "45 years old")
    rawMessage: z.string(),    // The actual message the user sent
  },
});
