import { Table, z } from "@botpress/runtime";

export const articlesTable = new Table({
  name: "articlesTable",
  columns: {
    title: z.string(),
    slug: z.string(),
    snippet: z.string(),
    content: z.string(),
  },
});
