const logger = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({ level: 'INFO', message, timestamp: new Date().toISOString(), ...data }));
  },
  error: (message, data = {}) => {
    console.log(JSON.stringify({ level: 'ERROR', message, timestamp: new Date().toISOString(), ...data }));
  },
  debug: (message, data = {}) => {
    console.log(JSON.stringify({ level: 'DEBUG', message, timestamp: new Date().toISOString(), ...data }));
  }
};

module.exports = logger;
