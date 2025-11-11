require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const HIPPOCLOUDS_SYSTEM_PROMPT = `
IMPORTANT: You are an AI assistant for Hippo Cloud Technologies. You MUST use the company information provided below to answer all questions. Do not say you don't have access to this information - it is provided to you here.

COMPANY INFORMATION:

**Company:** Hippo Cloud Technologies Pvt. Ltd
**Tagline:** "Transform Your Business with Innovative Software Solutions."

**Contact Information:**
- Phone: +91 93478 62547
- Email: info@hippoclouds.com
- Website: www.hippoclouds.com
- Main Branch: 2nd Floor, CBM Compound, Asilmetta, Visakhapatnam, Andhra Pradesh 530003
- Branch 2: 122-D, No. 3-73/2B, H.I.G., near SFS School, Midhilapuri VUDA Colony, Madhurawada, Visakhapatnam, AP 530041

**About:** Software and digital solutions company with 10+ years experience offering end-to-end IT services and skill development programs.

**Core Services:**
- Web Development
- App Development  
- Digital Marketing (SEO, SEM, Social Media, Content, Email, Influencer Marketing)
- Graphic Design

**Training Programs:** Full Stack, Android, Python, Digital Marketing, etc. with 100% job assistance.

**Response Guidelines:**
- Always provide accurate contact information from the data above
- Be concise and helpful
- If users misspell "HippoClouds" as "Huppoclouds" or similar, still answer correctly
- Never say you don't have access to this information
- Keep answers short and precise
`;

// Define headers here to be reused in all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Allows all origins
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

// Helper to ensure history exists and is properly formatted
function ensureHistory(session) {
  global.chatHistory = global.chatHistory || {};
  
  if (!global.chatHistory[session] || 
      !Array.isArray(global.chatHistory[session]) || 
      global.chatHistory[session].length === 0 ||
      global.chatHistory[session][0].role !== 'system') {
    
    global.chatHistory[session] = [
      { role: "system", content: HIPPOCLOUDS_SYSTEM_PROMPT }
    ];
  }
  
  return global.chatHistory[session];
}

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
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const message = body.message;

    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "message is required and must be a string" }),
      };
    }

    const session = context.clientContext && context.clientContext.user
      ? context.clientContext.user.sub
      : "public-user";

    // Use the improved history management
    const history = ensureHistory(session);
    history.push({ role: 'user', content: message });

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: history,
      max_tokens: 500,
      temperature: 0.15 // Using the same temperature as server.js for consistency
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
        const errorData = await response.json();
        console.error("Groq API Error:", errorData);
        return {
            statusCode: response.status,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "API error", details: errorData.error?.message || 'Failed to fetch from API' }),
        };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I could not generate a response.";

    // Append assistant message to history
    history.push({ role: 'assistant', content: reply });

    // Keep session history length bounded to avoid long payloads (same as server.js)
    if (history.length > 40) {
      // Keep system prompt + last 30 messages
      global.chatHistory[session] = [history[0]].concat(history.slice(-30));
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS, 
      body: JSON.stringify({ reply }),
    };

  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Server error", details: err.message }),
    };
  }
};