exports.handler = async () => {
  const gistId = process.env.GIST_ID;
  const token = process.env.GITHUB_TOKEN;

  try {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    const gist = await resp.json();
    const file = gist.files?.['cards.json'];

    let content;
    if (file?.truncated) {
      // File too large for inline content — fetch from raw URL
      const rawResp = await fetch(file.raw_url, {
        headers: { 'Authorization': `token ${token}` },
      });
      content = await rawResp.text();
    } else {
      content = file?.content || '[]';
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: content,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
