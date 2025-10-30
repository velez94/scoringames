const { HeatsMode } = require('./modes/HeatsMode');
const { VersusMode } = require('./modes/VersusMode');
const { SimultaneousMode } = require('./modes/SimultaneousMode');

class CompetitionModeFactory {
  static create(mode, config) {
    switch (mode) {
      case 'HEATS':
        return new HeatsMode(config);
      case 'VERSUS':
        return new VersusMode(config);
      case 'SIMULTANEOUS':
        return new SimultaneousMode(config);
      default:
        throw new Error(`Unknown competition mode: ${mode}`);
    }
  }
}

module.exports = { CompetitionModeFactory };
