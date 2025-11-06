require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Define headers here to be reused in all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Allows all origins
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

  // Reject non-POST methods
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get the Bot Token and Chat ID from Netlify environment variables
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram Bot Token or Chat ID is not set.');
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Server configuration error.' })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    // Basic validation
    if (!data.firstName || !data.email || !data.message) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required fields.' })
      };
    }

    // Format the message for Telegram
    // Using MarkdownV2 for formatting. Note special chars must be escaped.
    const format = (str) => str.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
    
    let message = `*New Contact Form Submission* 🦛\n\n`;
    message += `*Name:* ${format(data.firstName)} ${format(data.lastName || '')}\n`;
    message += `*Email:* ${format(data.email)}\n`;
    
    if (data.phoneNumber) {
      message += `*Phone:* ${format(data.countryCode || '')} ${format(data.phoneNumber)}\n`;
    }
    
    message += `*Message:*\n${format(data.message)}`;

    // Construct the Telegram API URL
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    // Send the message to Telegram
    const telegramResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'MarkdownV2', // Using Markdown for formatting
      }),
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API Error:', telegramResult);
      throw new Error(telegramResult.description || 'Failed to send message to Telegram.');
    }

    // Send success response to the frontend
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Submission successful' }),
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