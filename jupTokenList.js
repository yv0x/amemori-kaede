// manually check if a token exists in the JUP list

const axios = require('axios');

const mintAddress = '7iT1GRYYhEop2nV1dyCwK2MGyLmPHq47WhPGSwiqcUg5'; // replace with your mint address

axios.get('https://token.jup.ag/all')
  .then(response => {
    const tokens = response.data;
    // console.log(tokens);

    for (let i = 0; i < tokens.length; i++) {
      if(tokens[i].address === mintAddress) {
        console.log(`🚀 Token Name: ${tokens[i].name}, Token Symbol: ${tokens[i].symbol}`);
        break;
      }
    }
  })
  .catch(error => {
    console.error('❌ An error occurred:', error);
  });

// usage:
// set mint address
// node jupTokenList.js
