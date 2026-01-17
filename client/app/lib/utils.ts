/**
 * Utility functions for markdown processing and question detection
 */

/**
 * Detects question sentences in markdown content
 * A question is identified by ending with a question mark
 */
export function detectQuestions(content: string): Array<{
  text: string;
  index: number;
  startPos: number;
  endPos: number;
}> {
  const questions: Array<{
    text: string;
    index: number;
    startPos: number;
    endPos: number;
  }> = [];

  // Simple approach: find all sequences that end with ?
  // Match anything that ends with ? but don't start from the very beginning
  // Pattern: word characters, spaces, punctuation (not . ! ?) and ending with ?
  const questionRegex = /[A-Za-z][\w\s\*\-\(\)]*\?/g;
  
  let match;
  let questionIndex = 0;

  while ((match = questionRegex.exec(content)) !== null) {
    let question = match[0].trim();
    
    // Remove markdown formatting from the question text
    question = question.replace(/^\#+\s+/, ''); // remove headers
    question = question.replace(/^\*+/, '').replace(/\*+$/, ''); // remove bold markers
    
    // Skip if too short
    if (question.length > 2) {
      questions.push({
        text: question,
        index: questionIndex,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
      questionIndex++;
    }
  }

  return questions;
}

/**
 * Converts markdown to HTML
 * Simple implementation - for production use a library like marked or remark
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Code blocks
  html = html.replace(/```(.*?)```/gs, "<pre><code>$1</code></pre>");

  // Inline code
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, "");

  // Lists
  html = html.replace(/^\* (.*?)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*?<\/li>)/s, "<ul>$1</ul>");

  // Numbered lists
  html = html.replace(/^\d+\. (.*?)$/gm, "<li>$1</li>");

  return html;
}

/**
 * Extracts plain text from markdown
 */
export function extractPlainText(markdown: string): string {
  let text = markdown;

  // Remove headers
  text = text.replace(/^#+\s/gm, "");

  // Remove bold and italic markers
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");

  // Remove code blocks
  text = text.replace(/```(.*?)```/gs, "$1");
  text = text.replace(/`(.*?)`/g, "$1");

  // Remove links but keep text
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, "$1");

  return text;
}

/**
 * Highlights questions in markdown content
 * Returns HTML with questions wrapped in spans with data attributes
 */
export function highlightQuestions(markdown: string): string {
  const questions = detectQuestions(markdown);
  let result = markdown;

  // Sort by position descending to avoid offset issues
  questions.sort((a, b) => b.startPos - a.startPos);

  for (const question of questions) {
    const beforeText = result.substring(0, question.startPos);
    const questionText = result.substring(question.startPos, question.endPos);
    const afterText = result.substring(question.endPos);

    result =
      beforeText +
      `<mark class="question" data-question-id="${question.index}">${questionText}</mark>` +
      afterText;
  }

  return result;
}

/**
 * Fetches blog data from mock API (works on both client and server)
 */
export async function fetchBlog(slug: string) {
  try {
    // Construct the full URL for both client and server
    const baseUrl = typeof window === 'undefined' 
      ? 'http://localhost:3000'
      : '';
    
    const response = await fetch(`${baseUrl}/api/mock/${slug}.json`, {
      // Cache for 1 hour on server
      next: { revalidate: 3600 }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch blog: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching blog:", error);
    return null;
  }
}

/**
 * Fetches search results from mock API (works on both client and server)
 */
export async function fetchSearchResults() {
  try {
    // Construct the full URL for both client and server
    const baseUrl = typeof window === 'undefined' 
      ? 'http://localhost:3000'
      : '';
    
    const response = await fetch(`${baseUrl}/api/mock/search-results.json`, {
      // Cache for 1 hour on server
      next: { revalidate: 3600 }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch search results: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error("Error fetching search results:", error);
    return [];
  }
}

/**
 * Filters search results based on query
 */
export function filterResults(results: any[], query: string): any[] {
  if (!query.trim()) {
    return results;
  }

  const lowerQuery = query.toLowerCase();

  return results.filter((result) => {
    const title = result.title.toLowerCase();
    const excerpt = result.excerpt.toLowerCase();
    const category = result.category.toLowerCase();

    return (
      title.includes(lowerQuery) ||
      excerpt.includes(lowerQuery) ||
      category.includes(lowerQuery)
    );
  });
}
