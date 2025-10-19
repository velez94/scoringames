// Load AWS configuration from build-time injected config or environment variables
let config = {
  region: process.env.REACT_APP_REGION || 'us-east-2',
  apiUrl: process.env.REACT_APP_API_URL,
  userPoolId: process.env.REACT_APP_USER_POOL_ID,
  userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
};

// Try to load from build-time config file
try {
  const buildConfig = require('./aws-config.json');
  config = { ...config, ...buildConfig };
} catch (e) {
  // Config file doesn't exist, use environment variables
}

const awsConfig = {
  Auth: {
    region: config.region,
    userPoolId: config.userPoolId,
    userPoolWebClientId: config.userPoolClientId,
  },
  API: {
    endpoints: [
      {
        name: 'CalisthenicsAPI',
        endpoint: config.apiUrl,
      },
    ],
  },
};

export default awsConfig;
