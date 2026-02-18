exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const gistId = process.env.GIST_ID;
  const token = process.env.GITHUB_TOKEN;

  try {
    const newCard = JSON.parse(event.body);

    // Read current cards
    const getResp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    const gist = await getResp.json();
    const cards = JSON.parse(gist.files?.['cards.json']?.content || '[]');

    // Upsert: update if card with same id exists, otherwise add
    const existingIdx = cards.findIndex(c => c.id === newCard.id);
    if (existingIdx >= 0) {
      cards[existingIdx] = newCard;
    } else {
      cards.push(newCard);
    }

    // Write back
    const updateResp = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: { 'cards.json': { content: JSON.stringify(cards) } }
      }),
    });

    if (!updateResp.ok) {
      const err = await updateResp.text();
      throw new Error('Gist update failed: ' + err);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, totalCards: cards.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
