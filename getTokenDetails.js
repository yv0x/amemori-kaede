// jupiter token list
const axios = require('axios');

async function getTokenDetails(mintAddress) {
  return axios.get('https://token.jup.ag/all')
    .then(response => {
      const tokens = response.data;
      for (let i = 0; i < tokens.length; i++) {
        if(tokens[i].address === mintAddress) {
          console.log(`🚀 Token Name: ${tokens[i].name}, Token Symbol: ${tokens[i].symbol}`);
          return { name: tokens[i].name, symbol: tokens[i].symbol };
        }
      }
      return { name: 'Unknown', symbol: 'Unknown' }; // Return default if not found
    })
    .catch(error => {
      console.error('❌ An error occurred:', error);
      return { name: 'Unknown', symbol: 'Unknown' }; // Return default in case of error
    });
}
module.exports = getTokenDetails;
