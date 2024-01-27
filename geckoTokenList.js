const axios = require('axios');
const fs = require('fs');

const FILE_NAME = 'coingecko_list.json';

async function fetchAndSaveTokenList() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/list?include_platform=true');
        const data = response.data;
        fs.writeFileSync(FILE_NAME, JSON.stringify(data, null, 2));
        console.log(`Saved token list to '${FILE_NAME}'`);
    } catch (error) {
        console.error(`Failed to fetch and save token list: ${error}`);
    }
}

fetchAndSaveTokenList();
