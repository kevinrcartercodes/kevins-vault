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
    const files = Object.keys(gist.files || {});

    // Extract vault names from filenames: cards.json -> kevin, cards-colin.json -> colin
    const vaults = [];
    for (const f of files) {
      if (f === 'cards.json') {
        vaults.push('kevin');
      } else if (f.startsWith('cards-') && f.endsWith('.json')) {
        vaults.push(f.replace('cards-', '').replace('.json', ''));
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(vaults.sort()),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
