// netlify/functions/quiz.js
// Secure server-side proxy — keeps your API key off the client.
//
// Setup: In Netlify dashboard → Site → Environment variables, add:
//   Key:   ANTHROPIC_API_KEY
//   Value: sk-ant-...  (your Anthropic API key)

const SYSTEM_PROMPT = `You are a networking expert generating quiz questions for network engineers and students.
Generate exactly one multiple-choice question as a JSON object:
{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","explanation":"2-3 sentence explanation"}
Rules: answer must be exactly A, B, C, or D. Questions must be practical and varied (scenario-based, definitions, troubleshooting, calculations). Return ONLY the JSON object, no markdown, no extra text.`;

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable is not set.' }),
    };
  }

  let message;
  try {
    const body = JSON.parse(event.body);
    message = body.message;
    if (!message) throw new Error('missing message');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: response.status, body: err };
    }

    const data = await response.json();
    const raw = (data.content || []).map((b) => b.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
