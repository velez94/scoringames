const { Elimination } = require('../entities/Elimination');

class ProgressiveTournament {
  constructor(totalAthletes, eliminationRules = null) {
    this.totalAthletes = totalAthletes;
    this.eliminationRules = eliminationRules || this._generateDefaultRules(totalAthletes);
    this.stages = this._createStages();
    this.currentStage = 0;
  }

  static fromSnapshot(data) {
    const tournament = Object.create(ProgressiveTournament.prototype);
    Object.assign(tournament, data);
    tournament.stages = data.stages.map(stage => Elimination.fromSnapshot(stage));
    return tournament;
  }

  _generateDefaultRules(totalAthletes) {
    // Dynamic rule generation based on total athletes
    const rules = [];
    let remaining = totalAthletes;
    let stage = 1;

    while (remaining > 1) {
      let advancing, wildcards = 0;
      
      if (remaining <= 4) {
        // Final stages: direct elimination
        advancing = Math.floor(remaining / 2);
      } else if (remaining <= 8) {
        // Semi-final stage: direct elimination
        advancing = Math.floor(remaining / 2);
      } else {
        // Early stages: allow wildcards for more flexibility
        const directWinners = Math.floor(remaining / 2);
        const targetAdvancing = Math.ceil(remaining * 0.67); // Advance ~67% in early rounds
        advancing = Math.min(targetAdvancing, remaining - 1);
        wildcards = Math.max(0, advancing - directWinners);
      }

      rules.push({
        stage,
        from: remaining,
        to: advancing,
        wildcards,
        stageName: this._getStageName(stage, remaining, advancing)
      });

      remaining = advancing;
      stage++;
    }

    return rules;
  }

  _getStageName(stage, from, to) {
    if (to === 1) return 'Championship';
    if (to === 2) return 'Finals';
    if (to === 4) return 'Semifinals';
    if (to === 8) return 'Quarterfinals';
    if (from === 16) return 'Round of 16';
    return `Stage ${stage} (${from}→${to})`;
  }

  _createStages() {
    return this.eliminationRules.map((rule, index) => 
      new Elimination(
        `stage-${rule.stage}`,
        rule.stageName,
        rule.stage,
        rule.from,
        rule.to,
        rule.wildcards || 0
      )
    );
  }

  getCurrentStage() {
    return this.stages[this.currentStage];
  }

  createCurrentStageMatches(athletes) {
    const currentStage = this.getCurrentStage();
    if (!currentStage) return [];
    
    return currentStage.createMatches(athletes);
  }

  async processStageResults(matchResults, scoreService) {
    const currentStage = this.getCurrentStage();
    if (!currentStage) return null;

    // Enhanced result processing with score integration
    const result = await this._processResultsWithScores(currentStage, matchResults, scoreService);
    
    // Advance to next stage if current is complete
    if (currentStage.isComplete()) {
      this.currentStage++;
    }

    return {
      stage: currentStage.stage,
      stageName: currentStage.filterName,
      ...result,
      nextStage: this.hasNextStage() ? this.stages[this.currentStage] : null,
      tournamentComplete: this.isComplete()
    };
  }

  async _processResultsWithScores(stage, matchResults, scoreService) {
    // Process basic match results
    const basicResult = stage.processResults(matchResults);
    
    // If wildcards needed, use score-based selection
    if (stage.wildcardCount > 0 && scoreService) {
      const losers = stage.matches
        .filter(m => m.completed && m.loser)
        .map(m => m.loser);

      if (losers.length > stage.wildcardCount) {
        // Get scores for all losers to select best performers
        const loserScores = await scoreService.getAthleteScores(losers, stage.filterId);
        
        // Sort by score (highest first) and select top wildcards
        const sortedLosers = loserScores
          .sort((a, b) => b.score - a.score)
          .slice(0, stage.wildcardCount)
          .map(s => s.athleteId);

        stage.wildcards = sortedLosers;
        stage.eliminated = losers.filter(loser => !stage.wildcards.includes(loser));
      }
    }

    return {
      winners: stage.winners,
      wildcards: stage.wildcards,
      eliminated: stage.eliminated,
      advancing: stage.getAdvancingAthletes()
    };
  }

  hasNextStage() {
    return this.currentStage < this.stages.length;
  }

  isComplete() {
    return this.currentStage >= this.stages.length;
  }

  getChampion() {
    if (!this.isComplete()) return null;
    
    const finalStage = this.stages[this.stages.length - 1];
    return finalStage.winners[0] || null;
  }

  getTournamentBracket() {
    return {
      totalAthletes: this.totalAthletes,
      currentStage: this.currentStage + 1,
      totalStages: this.stages.length,
      stages: this.stages.map(stage => ({
        stage: stage.stage,
        name: stage.filterName,
        from: stage.totalAthletes,
        to: stage.advancingCount,
        wildcards: stage.wildcardCount,
        status: stage.status,
        matches: stage.matches.length,
        completed: stage.isComplete()
      })),
      champion: this.getChampion()
    };
  }

  toSnapshot() {
    return {
      totalAthletes: this.totalAthletes,
      eliminationRules: this.eliminationRules,
      currentStage: this.currentStage,
      stages: this.stages.map(stage => stage.toSnapshot())
    };
  }
}

module.exports = { ProgressiveTournament };
