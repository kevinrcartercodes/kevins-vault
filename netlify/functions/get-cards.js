exports.handler = async (event) => {
  const gistId = process.env.GIST_ID;
  const token = process.env.GITHUB_TOKEN;
  const vault = (event.queryStringParameters?.vault || 'kevin').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const filename = vault === 'kevin' ? 'cards.json' : `cards-${vault}.json`;

  try {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    const gist = await resp.json();
    const file = gist.files?.[filename];

    if (!file) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: '[]',
      };
    }

    // For large/truncated files, return the raw URL so the client can fetch directly
    // This avoids Netlify's 6MB function response limit
    if (file.truncated || (file.size && file.size > 5000000)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ redirect: file.raw_url }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: file.content || '[]',
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
