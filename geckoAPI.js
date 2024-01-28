const fs = require('fs');
const axios = require('axios');
// Cache object to store fetched token prices
const cacheFilePath = '.price_cache.json'; // Define the cache file path
const priceCache = {};

// Delay function to pause execution for a given number of milliseconds
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to get CoinGecko ID from local file
async function getCoinGeckoId(symbol) {
  if (!fs.existsSync('coingecko_list.json')) {
    console.log(`Local file 'coingecko_list.json' not found.`);
    return
  }
  const data = JSON.parse(fs.readFileSync('coingecko_list.json', 'utf-8'));
  const token = data.find(token => token.symbol === symbol.toLowerCase());
  console.log(`CoinGecko ID for '${symbol}' is: ${token ? token.id : "Unknown"}`);
  return token ? token.id : "Unknown";
}

// Function to get CoinGecko ID from local file, correctly this time
async function getCoinGeckoIdByMint(symbol, address) {
  if (!fs.existsSync('coingecko_list.json')) {
    console.log(`Local file 'coingecko_list.json' not found.`);
    return
  }
  const data = JSON.parse(fs.readFileSync('coingecko_list.json', 'utf-8'));
  const token = data.find(token => token.platforms && token.platforms.solana === address);
  console.log(`CoinGecko ID for '${symbol}' is: ${token ? token.id : "Unknown"}`);
  return token ? token.id : "Unknown";
}

// Function to fetch token price from CoinGecko with caching
async function fetchTokenPrice(token_id, date) {
  if (token_id === "Unknown") {
    return "Unknown";
  }
  // Read the cache from the file
  try {
    const cacheData = fs.readFileSync(cacheFilePath, 'utf-8');
    Object.assign(priceCache, JSON.parse(cacheData));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error reading cache file: ${error.message}`);
    }
    // If the file does not exist, we start with an empty cache
  }
  // Check if the price is already in the cache
  const cacheKey = `${token_id}_${date}`;
  if (priceCache[cacheKey]) {
    console.log(`Cached price for '${token_id}' on '${date}': ${priceCache[cacheKey]}`);
    return priceCache[cacheKey];
  }
  const formatted_date = date.split('-').reverse().join('-'); // converting 'YYYY-MM-DD' to 'DD-MM-YYYY'
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${token_id}/history?date=${formatted_date}`);
    console.log(`Price for '${token_id}' on '${date}': ${response.data.market_data.current_price.usd}`);
    // Store the fetched price in the cache and write it to the file
    priceCache[cacheKey] = response.data.market_data.current_price.usd;
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(priceCache, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing to cache file: ${error.message}`);
    }
    return response.data.market_data.current_price.usd;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 62;
      console.error(`Rate limit exceeded. Retrying after ${retryAfter} seconds.`);
      await delay(retryAfter * 1000); // Convert seconds to milliseconds
      return fetchTokenPrice(token_id, date); // Retry the request
    } else {
      console.error(`Error fetching price for token ID '${token_id}': ${error.message}`);
      // Cache the "Unknown" result to prevent repeated failed fetch attempts
      priceCache[cacheKey] = "Unknown";
      try {
        fs.writeFileSync(cacheFilePath, JSON.stringify(priceCache, null, 2), 'utf-8');
      } catch (writeError) {
        console.error(`Error writing to cache file: ${writeError.message}`);
      }
    }
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
  getCoinGeckoIdByMint 
};

// // Example usage
// // Replace 'sol' with your token's symbol
// // Define the date for which you want to fetch the price
// const date = '2023-12-30'; // Ensure this date is in 'YYYY-MM-DD' format
// const tokenName = 'SOL';
// getTokenPrice(tokenName, date).then(({ id, price }) => console.log(`Token ID: '${id}', Name: '${tokenName}', Date: ${date}, Price: ${price}`));
