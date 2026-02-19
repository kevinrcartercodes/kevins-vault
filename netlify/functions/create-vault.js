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
    const { name } = JSON.parse(event.body);
    const vault = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!vault || vault.length < 2) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Name must be at least 2 characters (letters/numbers only)' }),
      };
    }

    const filename = vault === 'kevin' ? 'cards.json' : `cards-${vault}.json`;

    // Check if vault already exists
    const getResp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    const gist = await getResp.json();

    if (gist.files?.[filename]) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Vault already exists' }),
      };
    }

    // Create empty cards file for the new vault
    const updateResp = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: { [filename]: { content: '[]' } }
      }),
    });

    if (!updateResp.ok) throw new Error('Failed to create vault');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, vault }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
