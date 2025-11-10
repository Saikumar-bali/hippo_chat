const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(JSON.stringify({ message: 'CORS preflight OK' }), {
        headers: CORS_HEADERS,
      });
    }

    try {
      // --- Chat endpoint ---
      if (path === '/chat' && request.method === 'POST') {
        const body = await request.json();
        const payload = {
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are the HippoClouds assistant." },
            { role: "user", content: body.message }
          ],
        };

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GROQ_API_KEY}`
          },
          body: JSON.stringify(payload)
        });

        const data = await groqResponse.json();
        const reply = data.choices?.[0]?.message?.content || "No response.";
        return new Response(JSON.stringify({ reply }), { headers: CORS_HEADERS });
      }

      // --- Reset endpoint ---
      if (path === '/reset' && request.method === 'POST') {
        globalThis.chatHistory = {};
        return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS });
      }

      // --- Submit-contact endpoint ---
      if (path === '/submit-contact' && request.method === 'POST') {
        const data = await request.json();
        const msg = `New Contact Form Submission 🦛\n\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nMessage: ${data.message}`;

        const telegramURL = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const tgResponse = await fetch(telegramURL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: msg
          })
        });

        const result = await tgResponse.json();
        return new Response(JSON.stringify({ success: true, result }), { headers: CORS_HEADERS });
      }

      // --- Live Chat: Start Session ---
      if (path === '/live-chat/start' && request.method === 'POST') {
        const body = await request.json();
        const sessionId = generateSessionId();
        const userInfo = {
          sessionId,
          userName: body.userName || 'Anonymous',
          email: body.email || '',
          startedAt: new Date().toISOString(),
          messages: [],
          status: 'active'
        };

        await env.CHAT_SESSIONS.put(sessionId, JSON.stringify(userInfo));

// In the sendTelegramMessage calls, update the URL:
    const telegramMsg = `🦛 New Live Chat Started\n\nUser: ${body.userName || 'Anonymous'}\nEmail: ${body.email || 'Not provided'}\nSession ID: ${sessionId}\n\nClick here to chat: https://your-netlify-site.netlify.app/admin-live-chat.html?session=${sessionId}`;
        await sendTelegramMessage(env, telegramMsg);

        return new Response(JSON.stringify({
          sessionId,
          message: 'Live chat session started'
        }), { headers: CORS_HEADERS });
      }

      // --- Live Chat: Send Message ---
      if (path === '/live-chat/send' && request.method === 'POST') {
        const body = await request.json();
        const { sessionId, message, sender } = body;

        const sessionData = await env.CHAT_SESSIONS.get(sessionId);
        if (!sessionData) {
          return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: CORS_HEADERS
          });
        }

        const session = JSON.parse(sessionData);
        const newMessage = {
          id: generateMessageId(),
          sender,
          message,
          timestamp: new Date().toISOString()
        };

        session.messages.push(newMessage);
        await env.CHAT_SESSIONS.put(sessionId, JSON.stringify(session));

        if (sender === 'user') {
          const telegramMsg = `💬 New Message in Live Chat\n\nSession: ${sessionId}\nUser: ${session.userName}\nMessage: ${message}\n\nReply: https://admin.hippoclouds.com/live-chat?session=${sessionId}`;
          await sendTelegramMessage(env, telegramMsg);
        }

        return new Response(JSON.stringify({
          success: true,
          messageId: newMessage.id
        }), { headers: CORS_HEADERS });
      }

      // --- Live Chat: Get Messages ---
      if (path === '/live-chat/messages' && request.method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'Session ID required' }), {
            status: 400,
            headers: CORS_HEADERS
          });
        }

        const sessionData = await env.CHAT_SESSIONS.get(sessionId);
        if (!sessionData) {
          return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: CORS_HEADERS
          });
        }

        const session = JSON.parse(sessionData);
        return new Response(JSON.stringify({
          messages: session.messages,
          userInfo: {
            userName: session.userName,
            email: session.email,
            startedAt: session.startedAt
          }
        }), { headers: CORS_HEADERS });
      }

      // --- Live Chat: Get All Active Sessions ---
      if (path === '/live-chat/sessions' && request.method === 'GET') {
        const sessions = await getAllActiveSessions(env);
        return new Response(JSON.stringify({ sessions }), { headers: CORS_HEADERS });
      }

      // --- Default 404 ---
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
    }
  }
};

// --- Helper functions ---
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateMessageId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function sendTelegramMessage(env, message) {
  const telegramURL = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(telegramURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message
    })
  });
  return response.json();
}

// Replace the getAllActiveSessions function with this:
async function getAllActiveSessions(env) {
  const sessions = [];
  
  try {
    // Since we don't have a proper session listing mechanism yet,
    // we'll return the sessions we know about
    // In production, you'd want to use KV list or maintain a sessions index
    
    // For now, this is a placeholder - you'll need to implement proper session tracking
    console.log('Session listing not fully implemented yet');
    
  } catch (error) {
    console.error('Error fetching sessions:', error);
  }
  
  return sessions;
}
