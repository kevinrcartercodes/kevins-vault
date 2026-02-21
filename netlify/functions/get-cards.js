const zlib = require('zlib');

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

    let content;
    if (file.truncated) {
      const rawResp = await fetch(file.raw_url, {
        headers: { 'Authorization': `token ${token}` },
      });
      content = await rawResp.text();
    } else {
      content = file.content || '[]';
    }

    // Gzip compress to stay under Netlify's 6MB response limit
    const compressed = zlib.gzipSync(Buffer.from(content, 'utf-8'));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Access-Control-Allow-Origin': '*',
      },
      body: compressed.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
