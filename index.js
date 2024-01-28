const axios = require('axios');
const fs = require('fs');
const { Parser } = require('json2csv');
const getTokenDetails = require('./getTokenDetails'); // Import getTokenList function
const { fetchTokenPrice, getCoinGeckoIdByMint } = require('./geckoAPI'); // Import gecko functions

// Flag to filter out tokens with a balance of 0 or 1
const filterZeroAndOneBalances = true;
// Flag to filter out tokens with the name "Unknown"
const filterUnknownTokens = true;
// Flag to fetch CoinGecko IDs for tokens
const fetchCoinGeckoIds = true;
// Flag to fetch token prices from CoinGecko
const fetchTokenPrices = true;
const fetchDate = '2023-12-30'; // Define the date for fetching token prices

// Helper function to perform API requests with retry on 429 status code
async function performRequestWithRetry(url, data, retries = 3, backoff = 1000) {
  try {
    const response = await axios.post(url, data);
    return response;
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      // Parse the Retry-After header to determine wait time, or use exponential backoff
      const retryAfter = error.response.headers['retry-after'] ? parseInt(error.response.headers['retry-after']) * 1000 : backoff;
      console.log(`Rate limit exceeded for ${url}, retrying after ${retryAfter}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return performRequestWithRetry(url, data, retries - 1, backoff * 2);
    } else {
      throw error;
    }
  }
}

async function getAllBalances(addresses) {
  for (const address of addresses) {
    try {
      // Get Token Balances
      let tokenRes = await performRequestWithRetry('https://api.mainnet-beta.solana.com', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          },
          { encoding: 'jsonParsed', commitment: 'confirmed' },
        ],
      });

      // Use an async for...of loop to fetch token details with proper await usage
      const tokenBalancesPromises = [];
      for (const accountInfo of tokenRes.data.result.value) {
        if (!filterZeroAndOneBalances || (accountInfo.account.data.parsed.info.tokenAmount.uiAmount !== 0 && accountInfo.account.data.parsed.info.tokenAmount.uiAmount !== 1)) {
          tokenBalancesPromises.push((async () => {
            const tokenData = await getTokenDetails(accountInfo.account.data.parsed.info.mint);
            if (filterUnknownTokens && tokenData.name === "Unknown") {
              return null;
            }
            return {
              mint: accountInfo.account.data.parsed.info.mint,
              tokenAmount: accountInfo.account.data.parsed.info.tokenAmount.uiAmount,
              tokenName: tokenData.name,
              tokenSymbol: tokenData.symbol,
              type: 'Token'
            };
          })());
        }
      }
      const tokenBalances = (await Promise.all(tokenBalancesPromises)).filter(token => token !== null); // Filter out null values resulting from "Unknown" tokens
      // Fetch token CoinGecko IDs if the flag is set
      if (fetchCoinGeckoIds) {
        for (let token of tokenBalances) {
          if (token.tokenName !== "Unknown") {
            // Fetch CoinGecko ID
            token.coinGeckoId = await getCoinGeckoIdByMint(token.tokenSymbol, token.mint) || "Unknown";

            // Fetch token price if CoinGecko ID is found and fetchTokenPrices flag is set
            if (fetchTokenPrices && token.coinGeckoId !== "Unknown") {
              token.tokenPrice = await fetchTokenPrice(token.coinGeckoId, fetchDate) || 0;
            }
          } else {
            token.coinGeckoId = "Unknown";
          }
        }
      }

      // Get SOL balance
      let solRes = await performRequestWithRetry('https://api.mainnet-beta.solana.com', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      });

      const solInLamports = solRes.data.result.value;
      const solBalance = [{ mint: 'SOL', tokenAmount: solInLamports / 1_000_000_000, type: 'Native' }];
      // Add SOL price if the flag is set
      if (fetchTokenPrices) {
        const solPriceData = await fetchTokenPrice('solana', fetchDate);
        solBalance[0].tokenPrice = solPriceData !== "Unknown" ? solPriceData : 0;
      }

      const allBalances = [...tokenBalances, ...solBalance];

      const csvFields = ['mint', 'tokenAmount', 'tokenName', 'tokenSymbol', 'type', 'coinGeckoId', 'tokenPrice']; // include coinGeckoId and tokenPrice
      const json2csvParser = new Parser({ csvFields });
      const csvData = json2csvParser.parse(allBalances);
      const filePath = `${address.substring(0, 4)}-balances.csv`;
      fs.writeFileSync(filePath, csvData);
      console.log(`Data successfully written to ${filePath}`);
    } catch (error) {
      console.error(`Failed to process address ${address}:`, error);
    }
  }
}

(async function processAddresses() {
  try {
    // Read addresses from a dotfile
    const dotfilePath = './.addresses';
    const addresses = fs.readFileSync(dotfilePath, 'utf-8').split('\n').filter(line => line.trim() !== '');
    console.log(addresses);

    // Process all addresses
    await getAllBalances(addresses);
  } catch (error) {
    console.error('An error occurred while processing addresses:', error);
  }
})();
