exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const card = JSON.parse(event.body);

    // Build a single focused query: year + player + auto + serial
    // Skip set/subset names — they add noise and cause zero-result misses
    const parts = [];
    if (card.year) parts.push(card.year);
    parts.push(card.player || '');
    if (card.autograph === 'yes') parts.push('auto');
    if (card.serial) parts.push(card.serial);
    if (card.grade) parts.push(card.grade);
    const query = parts.filter(Boolean).join(' ');

    const url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query)
      + '&LH_Complete=1&LH_Sold=1&_sacat=212';

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await resp.text();

    // Extract prices
    const prices = [];
    const priceRegex = /(?:s-card__price|s-item__price)">\s*\$([0-9,]+\.\d{2})/g;
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (price > 0.99) prices.push(price);
    }

    // Set a minimum price floor to filter out base card noise
    let floor = 5;
    if (card.autograph === 'yes') floor = 15;
    if (card.serial) {
      const num = parseInt(card.serial.replace(/\//g, ''));
      if (num <= 10) floor = 50;
      else if (num <= 25) floor = 25;
    }
    if (card.grade) floor = Math.max(floor, 20);

    const filtered = prices.filter(p => p >= floor);

    if (filtered.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ found: false, query }),
      };
    }

    filtered.sort((a, b) => a - b);
    const median = filtered[Math.floor(filtered.length / 2)];
    const avg = filtered.reduce((s, p) => s + p, 0) / filtered.length;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        found: true,
        query,
        count: filtered.length,
        median: Math.round(median),
        avg: Math.round(avg),
        low: Math.round(filtered[0]),
        high: Math.round(filtered[filtered.length - 1]),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
