class Elimination {
  constructor(filterId, filterName, stage, totalAthletes, advancingCount, wildcardCount = 0) {
    this.filterId = filterId;
    this.filterName = filterName;
    this.stage = stage; // 1, 2, 3 (Stage 1: 12→8, Stage 2: 8→4, Stage 3: 4→2)
    this.totalAthletes = totalAthletes;
    this.advancingCount = advancingCount;
    this.wildcardCount = wildcardCount;
    this.status = 'PENDING'; // PENDING, IN_PROGRESS, COMPLETED
    this.matches = [];
    this.winners = [];
    this.wildcards = [];
    this.eliminated = [];
  }

  static fromSnapshot(data) {
    const elimination = Object.create(Elimination.prototype);
    return Object.assign(elimination, data);
  }

  createMatches(athletes) {
    const shuffled = [...athletes].sort(() => Math.random() - 0.5);
    const matchCount = Math.floor(shuffled.length / 2);
    
    this.matches = [];
    for (let i = 0; i < matchCount; i++) {
      const athlete1 = shuffled[i * 2];
      const athlete2 = shuffled[i * 2 + 1];
      
      this.matches.push({
        matchId: `${this.filterId}-match-${i + 1}`,
        athlete1,
        athlete2,
        winner: null,
        loser: null,
        completed: false
      });
    }
    
    this.status = 'IN_PROGRESS';
    return this.matches;
  }

  processResults(matchResults) {
    // Update matches with results
    for (const result of matchResults) {
      const match = this.matches.find(m => m.matchId === result.matchId);
      if (match) {
        match.winner = result.winnerId;
        match.loser = result.loserId;
        match.completed = true;
      }
    }

    // Extract winners
    this.winners = this.matches
      .filter(m => m.completed && m.winner)
      .map(m => m.winner);

    // Extract losers for wildcard selection
    const losers = this.matches
      .filter(m => m.completed && m.loser)
      .map(m => m.loser);

    // Select wildcards if needed
    if (this.wildcardCount > 0 && losers.length >= this.wildcardCount) {
      // For now, random selection - could be enhanced with score-based selection
      this.wildcards = losers
        .sort(() => Math.random() - 0.5)
        .slice(0, this.wildcardCount);
    }

    // Calculate eliminated athletes
    this.eliminated = losers.filter(loser => !this.wildcards.includes(loser));

    // Check if elimination is complete
    const advancingAthletes = this.winners.length + this.wildcards.length;
    if (advancingAthletes === this.advancingCount) {
      this.status = 'COMPLETED';
    }

    return {
      winners: this.winners,
      wildcards: this.wildcards,
      eliminated: this.eliminated,
      advancing: [...this.winners, ...this.wildcards]
    };
  }

  getAdvancingAthletes() {
    return [...this.winners, ...this.wildcards];
  }

  isComplete() {
    return this.status === 'COMPLETED';
  }

  toSnapshot() {
    return {
      filterId: this.filterId,
      filterName: this.filterName,
      stage: this.stage,
      totalAthletes: this.totalAthletes,
      advancingCount: this.advancingCount,
      wildcardCount: this.wildcardCount,
      status: this.status,
      matches: this.matches,
      winners: this.winners,
      wildcards: this.wildcards,
      eliminated: this.eliminated
    };
  }
}

module.exports = { Elimination };
