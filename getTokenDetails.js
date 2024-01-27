// jupiter token list
const axios = require('axios');
const logging = false; // Set to true to enable logging, false to disable
const tokenDetailsCache = {};

async function getTokenDetails(mintAddress, retries = 0) {
  function log(...args) {
    if (logging) {
      console.log(...args);
    }
  }

  log(`Fetching details for mint address: ${mintAddress}, Type: ${typeof mintAddress}`);
  log(`Current cache state:`, tokenDetailsCache);

  // Check if the token details are already in the cache or being fetched
  if (tokenDetailsCache[mintAddress]) {
    log(`Cache check for mint address: ${mintAddress}, Found: ${!!tokenDetailsCache[mintAddress]}`);
    // If the cache entry is a promise, wait for it to resolve
    if (tokenDetailsCache[mintAddress] instanceof Promise) {
      log(`Waiting for promise to resolve for mint address: ${mintAddress}`);
      return tokenDetailsCache[mintAddress];
    } else {
      log(`Cache hit for mint address: ${mintAddress}`);
      return tokenDetailsCache[mintAddress];
    }
  }

  // If not in cache, start fetching and store a promise in the cache
  log(`Starting fetch for mint address: ${mintAddress}`);
  tokenDetailsCache[mintAddress] = (async () => {
    try {
      const response = await axios.get('https://token.jup.ag/all', { timeout: 10000 });
      const tokens = response.data;
      for (let token of tokens) {
        if (token.address === mintAddress) {
          // Make this log happen every time
          console.log(`Token Name: ${token.name}, Token Symbol: ${token.symbol}`);
          tokenDetailsCache[mintAddress] = { name: token.name, symbol: token.symbol };
          log(`Caching token details for mint address: ${mintAddress}`);
          return tokenDetailsCache[mintAddress];
        }
      }
      tokenDetailsCache[mintAddress] = { name: 'Unknown', symbol: 'Unknown' };
      return tokenDetailsCache[mintAddress];
    } catch (error) {
      if (axios.isCancel(error)) {
        console.error('Request canceled:', error.message);
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEOUT') {
        console.error('Timeout error:', error.message);
        if (retries < 3) { // Retry up to 3 times
          log(`Retrying fetch for mint address: ${mintAddress}, retry count: ${retries + 1}`);
          return getTokenDetails(mintAddress, retries + 1);
        } else {
          console.error('Max retries reached for mint address:', mintAddress);
        }
      } else {
        console.error('An error occurred:', error);
      }
      tokenDetailsCache[mintAddress] = { name: 'Unknown', symbol: 'Unknown' };
      return tokenDetailsCache[mintAddress];
    }
  })();

  return tokenDetailsCache[mintAddress];
}
module.exports = getTokenDetails;
