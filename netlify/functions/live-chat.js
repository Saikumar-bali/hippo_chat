const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

exports.handler = async (event) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CLOUDFLARE_WORKER_URL } = process.env;

  // Check environment variables
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !CLOUDFLARE_WORKER_URL) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Server configuration error. Check environment variables.' })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const path = event.path.replace('/.netlify/functions/live-chat', '');

    // Start new live chat session
    if (path === '/start' && event.httpMethod === 'POST') {
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/live-chat/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify(result)
      };
    }

    // Send message
    if (path === '/send' && event.httpMethod === 'POST') {
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/live-chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify(result)
      };
    }

    // Get messages
    if (path === '/messages' && event.httpMethod === 'GET') {
      const sessionId = event.queryStringParameters.sessionId;
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/live-chat/messages?sessionId=${sessionId}`);
      
      const result = await response.json();
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify(result)
      };
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Endpoint not found' })
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