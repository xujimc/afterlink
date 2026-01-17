'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  questions: any[];
  onQuestionClick: (question: string) => void;
}

export default function MarkdownRenderer({
  content,
  questions,
  onQuestionClick,
}: MarkdownRendererProps) {

  const parseMarkdown = (markdown: string) => {
    const parts: React.ReactNode[] = [];
    const lines = markdown.split('\n');
    let currentList: string[] = [];
    let currentCode = '';
    let inCodeBlock = false;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Code block
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          parts.push(
            <pre key={`code-${parts.length}`} className="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4">
              <code className="text-sm text-gray-800">{currentCode}</code>
            </pre>
          );
          currentCode = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        i++;
        continue;
      }

      if (inCodeBlock) {
        currentCode += line + '\n';
        i++;
        continue;
      }

      // Headings
      if (trimmedLine.startsWith('### ')) {
        if (currentList.length > 0) {
          parts.push(renderList(currentList, parts.length));
          currentList = [];
        }
        parts.push(
          <h3 key={`h3-${parts.length}`} className="text-xl font-semibold text-black mt-6 mb-3">
            {renderInlineMarkdown(trimmedLine.substring(4))}
          </h3>
        );
        i++;
        continue;
      }

      if (trimmedLine.startsWith('## ')) {
        if (currentList.length > 0) {
          parts.push(renderList(currentList, parts.length));
          currentList = [];
        }
        parts.push(
          <h2 key={`h2-${parts.length}`} className="text-2xl font-semibold text-black mt-8 mb-4">
            {renderInlineMarkdown(trimmedLine.substring(3))}
          </h2>
        );
        i++;
        continue;
      }

      if (trimmedLine.startsWith('# ')) {
        if (currentList.length > 0) {
          parts.push(renderList(currentList, parts.length));
          currentList = [];
        }
        parts.push(
          <h1 key={`h1-${parts.length}`} className="text-3xl font-bold text-black mt-10 mb-5">
            {renderInlineMarkdown(trimmedLine.substring(2))}
          </h1>
        );
        i++;
        continue;
      }

      // Lists
      if (trimmedLine.startsWith('- ') || trimmedLine.match(/^\d+\. /)) {
        currentList.push(trimmedLine.replace(/^(- |\d+\. )/, ''));
        i++;
        continue;
      }

      // Empty line
      if (trimmedLine === '') {
        if (currentList.length > 0) {
          parts.push(renderList(currentList, parts.length));
          currentList = [];
        }
        i++;
        continue;
      }

      // Paragraph
      if (currentList.length > 0) {
        parts.push(renderList(currentList, parts.length));
        currentList = [];
      }

      parts.push(
        <p key={`p-${parts.length}`} className="text-gray-800 leading-7 my-4">
          {renderInlineMarkdown(trimmedLine)}
        </p>
      );
      i++;
    }

    if (currentList.length > 0) {
      parts.push(renderList(currentList, parts.length));
    }

    return parts;
  };

  const renderList = (items: string[], key: number) => {
    return (
      <ul key={`list-${key}`} className="list-disc list-inside my-4 text-gray-800 space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="ml-4">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ul>
    );
  };

  const renderInlineMarkdown = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Create a map of exact question matches
    const questionMap = new Map<string, number>();
    questions.forEach((q) => {
      questionMap.set(q.text, q.index);
    });

    while (remaining.length > 0) {
      let matched = false;

      // Try to match questions first (exact match only)
      for (const [questionText, questionIndex] of questionMap.entries()) {
        if (remaining.startsWith(questionText)) {
          parts.push(
            <button
              key={`q-${key++}`}
              onClick={() => onQuestionClick(questionText)}
              className="bg-yellow-100 cursor-pointer hover:bg-yellow-200 transition-colors text-black font-medium inline"
            >
              {questionText}
            </button>
          );
          remaining = remaining.substring(questionText.length);
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // Try to match bold **text**
      const boldMatch = remaining.match(/^\*\*(.*?)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={`b-${key++}`} className="font-bold">
            {renderInlineMarkdown(boldMatch[1])}
          </strong>
        );
        remaining = remaining.substring(boldMatch[0].length);
        continue;
      }

      // Try to match italic *text*
      const italicMatch = remaining.match(/^\*(.*?)\*/);
      if (italicMatch) {
        parts.push(
          <em key={`i-${key++}`} className="italic">
            {renderInlineMarkdown(italicMatch[1])}
          </em>
        );
        remaining = remaining.substring(italicMatch[0].length);
        continue;
      }

      // Try to match inline code `text`
      const codeMatch = remaining.match(/^`(.*?)`/);
      if (codeMatch) {
        parts.push(
          <code
            key={`c-${key++}`}
            className="bg-gray-100 px-2 py-1 rounded text-sm font-mono"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.substring(codeMatch[0].length);
        continue;
      }

      // Try to match links [text](url)
      const linkMatch = remaining.match(/^\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={`l-${key++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {renderInlineMarkdown(linkMatch[1])}
          </a>
        );
        remaining = remaining.substring(linkMatch[0].length);
        continue;
      }

      // No special formatting - take regular text until next special char
      const regularMatch = remaining.match(
        /^[^*`[\]]+?(?=\*{1,2}|`|\[|$)/
      );
      if (regularMatch) {
        parts.push(regularMatch[0]);
        remaining = remaining.substring(regularMatch[0].length);
        continue;
      }

      // Fallback: take one character
      parts.push(remaining[0]);
      remaining = remaining.substring(1);
    }

    return parts.length > 0 ? parts : [text];
  };

  return (
    <div className="prose prose-sm max-w-none">
      {parseMarkdown(content)}
    </div>
  );
}
