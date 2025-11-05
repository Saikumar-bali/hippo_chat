exports.handler = async () => {
  global.chatHistory = {};
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
