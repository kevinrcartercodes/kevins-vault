exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const card = JSON.parse(event.body);

    // Build eBay sold-listings search query
    const parts = [];
    if (card.year) parts.push(card.year);
    if (card.set) parts.push(card.set);
    if (card.subset) parts.push(card.subset);
    if (card.player) parts.push(card.player);
    if (card.autograph === 'yes') parts.push('auto');
    if (card.serial) parts.push(card.serial);
    if (card.grade) parts.push(card.grade);
    const query = parts.join(' ');

    const url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query)
      + '&LH_Complete=1&LH_Sold=1&_sacat=212&_sop=13'; // 212=Sports Cards, sop=13=price+shipping lowest

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await resp.text();

    // Extract sold prices from eBay HTML
    // eBay shows prices in <span class="s-item__price"> elements
    const prices = [];
    const priceRegex = /class="s-item__price"[^>]*>\s*\$([0-9,]+\.\d{2})/g;
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (price > 0.99) { // filter out penny listings / base cards
        prices.push(price);
      }
    }

    // Calculate stats
    if (prices.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ found: false, query }),
      };
    }

    prices.sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const low = prices[0];
    const high = prices[prices.length - 1];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        found: true,
        query,
        count: prices.length,
        median: Math.round(median),
        avg: Math.round(avg),
        low: Math.round(low),
        high: Math.round(high),
        prices: prices.slice(0, 10), // first 10 for reference
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
