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

// Define headers here to be reused in all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Allows all origins
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

exports.handler = async (event, context) => {

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  // Reject non-POST methods (that aren't OPTIONS)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS, // Add headers here too
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const message = body.message;

    if (!message) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS, // Add headers to error responses
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

    if (!response.ok) {
        // Handle API errors
        const errorData = await response.json();
        console.error("Groq API Error:", errorData);
        return {
            statusCode: response.status,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "API error", details: errorData.error?.message || 'Failed to fetch from API' }),
        };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response.";

    history.push({ role: "assistant", content: reply });

    // *** THIS IS THE KEY FIX ***
    // Add CORS_HEADERS to the successful response
    return {
      statusCode: 200,
      headers: CORS_HEADERS, 
      body: JSON.stringify({ reply }),
    };

  } catch (err) {
    console.error("Error:", err);
    // Add CORS_HEADERS to the catch-all error response
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Server error", details: err.message }),
    };
  }
};