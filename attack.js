const axios = require('axios');

const url = 'http://localhost:3000'; // Your test server URL

const simulateRequest = async () => {
  try {
    await axios.get(url);
    console.log('Request sent');
  } catch (error) {
    console.error('Error:', error.message);
  }
};

const startSimulation = () => {
  for (let i = 0; i < 1000; i++) {
    simulateRequest();
  }
};

startSimulation();