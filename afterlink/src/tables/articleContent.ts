import { Table, z } from "@botpress/runtime";

export const articleContentTable = new Table({
  name: "articleContentTable",
  columns: {
    articleId: z.number(), // Reference to articlesTable
    content: z.string(),   // Full article content with {{Q:...}} markers
  },
});
