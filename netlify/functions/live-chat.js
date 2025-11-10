const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

// In-memory storage for chat sessions (for demo - in production use a database)
let chatSessions = new Map();

exports.handler = async (event) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  // Check environment variables
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Server configuration error. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.' })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const path = event.path.replace('/.netlify/functions/live-chat', '');

    // Start new live chat session
    if (path === '/start' && event.httpMethod === 'POST') {
      const sessionId = generateSessionId();
      const userInfo = {
        sessionId,
        userName: data.userName || 'Anonymous',
        email: data.email || '',
        startedAt: new Date().toISOString(),
        messages: [],
        status: 'active'
      };

      // Store session in memory
      chatSessions.set(sessionId, userInfo);

      // Send Telegram notification to admin
      const telegramMsg = `🦛 New Live Chat Started\n\nUser: ${data.userName || 'Anonymous'}\nEmail: ${data.email || 'Not provided'}\nSession ID: ${sessionId}\n\nClick here to chat: https://hippochatbot.netlify.app/admin-live-chat.html?session=${sessionId}`;
      
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, telegramMsg);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          sessionId, 
          message: 'Live chat session started' 
        })
      };
    }

    // Send message
    if (path === '/send' && event.httpMethod === 'POST') {
      const { sessionId, message, sender } = data;

      // Get session from memory
      const session = chatSessions.get(sessionId);
      if (!session) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }

      const newMessage = {
        id: generateMessageId(),
        sender,
        message,
        timestamp: new Date().toISOString()
      };

      session.messages.push(newMessage);
      chatSessions.set(sessionId, session);

      // If user sends message, notify admin via Telegram
      if (sender === 'user') {
        const telegramMsg = `💬 New Message in Live Chat\n\nSession: ${sessionId}\nUser: ${session.userName}\nMessage: ${message}\n\nReply: https://hippochatbot.netlify.app/admin-live-chat.html?session=${sessionId}`;
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, telegramMsg);
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          success: true, 
          messageId: newMessage.id 
        })
      };
    }

    // Get messages
    if (path === '/messages' && event.httpMethod === 'GET') {
      const sessionId = event.queryStringParameters.sessionId;

      if (!sessionId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Session ID required' })
        };
      }

      const session = chatSessions.get(sessionId);
      if (!session) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          messages: session.messages,
          userInfo: {
            userName: session.userName,
            email: session.email,
            startedAt: session.startedAt
          }
        })
      };
    }

    // Get all active sessions (for admin panel)
    if (path === '/sessions' && event.httpMethod === 'GET') {
      const sessions = Array.from(chatSessions.values()).filter(session => session.status === 'active');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ sessions })
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

// Helper functions
function generateSessionId() {
  return 'netlify_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateMessageId() {
  return 'netlify_msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function sendTelegramMessage(botToken, chatId, message) {
  const telegramURL = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(telegramURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message
    })
  });
  return response.json();
}