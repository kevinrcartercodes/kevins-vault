exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const card = JSON.parse(event.body);

    // Build progressively broader search queries
    // Start specific, broaden until we get results
    const queries = [];

    // Query 1: year + set + player + auto + serial + grade (most specific)
    const q1 = [card.year, card.set, card.player,
      card.autograph === 'yes' ? 'auto' : '',
      card.serial, card.grade].filter(Boolean).join(' ');
    queries.push(q1);

    // Query 2: year + set + player + auto + serial (drop grade)
    const q2 = [card.year, card.set, card.player,
      card.autograph === 'yes' ? 'auto' : '',
      card.serial].filter(Boolean).join(' ');
    if (q2 !== q1) queries.push(q2);

    // Query 3: year + set + player + auto (drop serial too)
    const q3 = [card.year, card.set, card.player,
      card.autograph === 'yes' ? 'auto' : ''].filter(Boolean).join(' ');
    if (q3 !== q2) queries.push(q3);

    // Query 4: year + player + auto + serial (drop set name, keep scarcity)
    const q4 = [card.year, card.player,
      card.autograph === 'yes' ? 'auto' : '',
      card.serial].filter(Boolean).join(' ');
    if (!queries.includes(q4)) queries.push(q4);

    let bestResult = null;

    for (const query of queries) {
      const url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query)
        + '&LH_Complete=1&LH_Sold=1&_sacat=212&_sop=13';

      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const html = await resp.text();
      const prices = extractPrices(html);

      if (prices.length >= 2) {
        bestResult = { query, prices };
        break; // good enough — use the most specific query with results
      }
      if (prices.length === 1 && !bestResult) {
        bestResult = { query, prices };
        // keep trying for more comps
      }
    }

    if (!bestResult || bestResult.prices.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ found: false, queries }),
      };
    }

    const prices = bestResult.prices;
    prices.sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        found: true,
        query: bestResult.query,
        count: prices.length,
        median: Math.round(median),
        avg: Math.round(avg),
        low: Math.round(prices[0]),
        high: Math.round(prices[prices.length - 1]),
        prices: prices.slice(0, 10),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function extractPrices(html) {
  const prices = [];
  const priceRegex = /class="s-item__price"[^>]*>\s*\$([0-9,]+\.\d{2})/g;
  let match;
  while ((match = priceRegex.exec(html)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 0.99) prices.push(price);
  }
  return prices;
}
