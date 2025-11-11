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
      // *** THIS IS THE KEY FIX ***
      // Changed model to Groq's standard Llama 3 70B, which is much better at following system prompts.
      model: "llama3-70b-8192", 
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