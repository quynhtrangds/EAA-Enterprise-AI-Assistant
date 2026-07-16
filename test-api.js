const fetch = require('node-fetch');

async function test() {
  const token = 'test-token-if-any'; // We need a real token or mock
  // actually let's just make a fetch without token, it will throw 401
  const response = await fetch('http://localhost:3000/api/chat/sessions/session-default', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer test`
    },
    body: JSON.stringify({ title: 'test' })
  });
  console.log(response.status);
  console.log(await response.text());
}
test();
