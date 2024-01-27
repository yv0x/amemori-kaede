const fs = require('fs');
const axios = require('axios');

// Delay function to pause execution for a given number of milliseconds
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to get CoinGecko ID from local file
async function getCoinGeckoId(symbol) {
  const data = JSON.parse(fs.readFileSync('coingecko_list.json', 'utf-8'));
  const token = data.find(token => token.symbol === symbol.toLowerCase());
  console.log(`CoinGecko ID for '${symbol}' is: ${token ? token.id : "Unknown"}`);
  return token ? token.id : "Unknown";
}

// Function to fetch token price from CoinGecko
async function fetchTokenPrice(token_id, date) {
  if (token_id === "Unknown") {
    return "Unknown";
  }
  const formatted_date = date.split('-').reverse().join('-'); // converting 'YYYY-MM-DD' to 'DD-MM-YYYY'
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${token_id}/history?date=${formatted_date}`);
    console.log(`Price for '${token_id}' on '${date}': ${response.data.market_data.current_price.usd}`);
    return response.data.market_data.current_price.usd;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 62;
      console.error(`Rate limit exceeded. Retrying after ${retryAfter} seconds.`);
      await delay(retryAfter * 1000); // Convert seconds to milliseconds
      return fetchTokenPrice(token_id, date); // Retry the request
    }
    console.error(`Error fetching price for token ID '${token_id}': ${error.message}`);
    return "Unknown";
  }
}

// Function to get token price and ID
async function getTokenPrice(symbol, date) {
  const id = await getCoinGeckoId(symbol.toLowerCase());
  console.log(`Fetching price for token symbol: '${symbol}'`);
  if (id === "Unknown") {
    return { id: "Unknown", price: "Unknown" };
  }
  const price = await fetchTokenPrice(id, date);
  return { id, price: price !== "Unknown" ? price : "Unknown" }; // Return both ID and price
}
module.exports = {
  fetchTokenPrice,
  getCoinGeckoId
};

// // Example usage
// // Replace 'sol' with your token's symbol
// // Define the date for which you want to fetch the price
// const date = '2023-12-30'; // Ensure this date is in 'YYYY-MM-DD' format
// const tokenName = 'SOL';
// getTokenPrice(tokenName, date).then(({ id, price }) => console.log(`Token ID: '${id}', Name: '${tokenName}', Date: ${date}, Price: ${price}`));
