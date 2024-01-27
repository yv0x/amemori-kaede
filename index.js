const axios = require('axios');
const fs = require('fs');
const { Parser } = require('json2csv');
const getTokenDetails = require('./getTokenDetails'); // Import getTokenList function
const { fetchTokenPrice, getCoinGeckoId } = require('./geckoAPI'); // Import gecko functions

// Flag to filter out tokens with a balance of 0 or 1
const filterZeroAndOneBalances = true;
// Flag to filter out tokens with the name "Unknown"
const filterUnknownTokens = true;
// Flag to fetch CoinGecko IDs for tokens
const fetchCoinGeckoIds = true;
// Flag to fetch token prices from CoinGecko
const fetchTokenPrices = true;
const fetchDate = '2023-12-30'; // Define the date for fetching token prices

async function getAllBalances(addresses) {

  addresses.forEach(async(address) => {
    // Get Token Balances
    let tokenRes = await axios.post('https://api.mainnet-beta.solana.com', {
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

    const tokenBalances = (await Promise.all(
      tokenRes.data.result.value
        .filter(accountInfo => {
          if (!filterZeroAndOneBalances) return true;
          const uiAmount = accountInfo.account.data.parsed.info.tokenAmount.uiAmount;
          return uiAmount !== 0 && uiAmount !== 1;
        })
        .map(async (accountInfo) => {
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
        })
    )).filter(token => token !== null); // Filter out null values resulting from "Unknown" tokens
    // Fetch token prices if the flag is set
    if (fetchCoinGeckoIds || fetchTokenPrices) {
      for (let token of tokenBalances) {
        if (fetchCoinGeckoIds) {
          const idData = await getCoinGeckoId(token.tokenSymbol);
          token.coinGeckoId = idData !== "Unknown" ? idData : "Unknown";
        }
        if (fetchTokenPrices) {
          const priceData = await fetchTokenPrice(token.coinGeckoId, fetchDate);
          token.tokenPrice = priceData !== "Unknown" ? priceData : 0;
        }
      }
    }
  // Get SOL balance
  let solRes = await axios.post('https://api.mainnet-beta.solana.com', {
    jsonrpc: '2.0',
    id: 1,
    method: 'getBalance',
    params: [ address,]
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

  fs.writeFileSync(`${address.substring(0, 4)}-balances.csv`, csvData, function (error) {
    if (error) throw error;
    console.log(`Data successfully written to ${address.substring(0, 4)}-balances.csv`);
  });
});
}

// Read addresses from a dotfile
const dotfilePath = './.addresses';
const addresses = fs.readFileSync(dotfilePath, 'utf-8').split('\n').filter(line => line.trim() !== '');
console.log(addresses);
getAllBalances(addresses);
