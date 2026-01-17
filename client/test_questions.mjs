import fs from 'fs';

const blogData = JSON.parse(fs.readFileSync('./public/api/mock/what-is-machine-learning.json', 'utf-8'));

function detectQuestions(content) {
  const questions = [];
  const questionRegex = /[A-Za-z][\w\s\*\-\(\)]*\?/g;
  
  let match;
  let questionIndex = 0;

  while ((match = questionRegex.exec(content)) !== null) {
    let question = match[0].trim();
    
    question = question.replace(/^\#+\s+/, '');
    question = question.replace(/^\*+/, '').replace(/\*+$/, '');
    
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

const questions = detectQuestions(blogData.content);
console.log('Found questions:', questions.length);
questions.slice(0, 10).forEach((q, i) => {
  console.log(`${i}: "${q.text}"`);
});
