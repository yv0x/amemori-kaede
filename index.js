const axios = require('axios');
const fs = require('fs');
const { Parser } = require('json2csv');
const getTokenDetails = require('./getTokenDetails'); // Import getTokenList function

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

    const tokenBalances = await Promise.all(tokenRes.data.result.value.map(async (accountInfo) => {
      const tokenData = await getTokenDetails(accountInfo.account.data.parsed.info.mint);
      return {
        mint: accountInfo.account.data.parsed.info.mint,
        tokenAmount: accountInfo.account.data.parsed.info.tokenAmount.uiAmount, // add tokenAmount
        tokenName: tokenData.name, // add tokenName
        tokenSymbol: tokenData.symbol, // add tokenSymbol
        type: 'Token'
      }
    }));
    // Get SOL balance
    let solRes = await axios.post('https://api.mainnet-beta.solana.com', {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [ address,]
    });

    const solInLamports = solRes.data.result.value;
    const solBalance = [{ mint: 'SOL', tokenAmount: solInLamports / 1_000_000_000, type: 'Native' }];

    const allBalances = [...tokenBalances, ...solBalance];

    const csvFields = ['mint', 'tokenAmount', 'tokenName', 'tokenSymbol', 'type']; // include tokenName and tokenSymbol
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
