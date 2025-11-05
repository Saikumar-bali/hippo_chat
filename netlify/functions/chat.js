require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const HIPPOCLOUDS_SYSTEM_PROMPT = `
You are the HippoClouds assistant. Use a helpful, concise, professional, friendly tone.
Services:
- Cloud Strategy & Consulting
- IaC
- Kubernetes
- 24/7 Cloud Support
- Security & Compliance
- Cost Optimization
`;

exports.handler = async (event, context) => {

    const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
  };
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const message = body.message;

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "message is required" }),
      };
    }

    const session = context.clientContext && context.clientContext.user
      ? context.clientContext.user.sub
      : "public-user";

    global.chatHistory = global.chatHistory || {};
    global.chatHistory[session] = global.chatHistory[session] || [
      { role: "system", content: HIPPOCLOUDS_SYSTEM_PROMPT }
    ];

    const history = global.chatHistory[session];
    history.push({ role: "user", content: message });

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: history,
      max_tokens: 500,
      temperature: 0.2
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response.";

    history.push({ role: "assistant", content: reply });

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };

  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", details: err.message }),
    };
  }
};
