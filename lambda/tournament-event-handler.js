const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridge = new EventBridgeClient({});

const SCHEDULES_TABLE = process.env.SCHEDULES_TABLE;

exports.handler = async (event) => {
  console.log('Tournament Event Handler:', JSON.stringify(event, null, 2));

  try {
    // Handle different event types
    for (const record of event.Records || [event]) {
      const eventDetail = record.detail || record;
      
      switch (eventDetail.DetailType || record.eventName) {
        case 'Match Result Submitted':
          await handleMatchResultSubmitted(eventDetail);
          break;
          
        case 'Tournament Advanced':
          await handleTournamentAdvanced(eventDetail);
          break;
          
        case 'Score Submitted':
          await handleScoreSubmitted(eventDetail);
          break;
          
        default:
          console.log('Unhandled event type:', eventDetail.DetailType);
      }
    }

    return { statusCode: 200, body: 'Events processed successfully' };

  } catch (error) {
    console.error('Tournament Event Handler Error:', error);
    throw error;
  }
};

async function handleMatchResultSubmitted(eventDetail) {
  const { eventId, scheduleId, matchId, winnerId, loserId } = eventDetail;
  
  console.log(`Processing match result: ${matchId} - Winner: ${winnerId}`);

  // Update schedule with match result
  await ddb.send(new UpdateCommand({
    TableName: SCHEDULES_TABLE,
    Key: { 
      PK: `EVENT#${eventId}`,
      SK: `SCHEDULE#${scheduleId}`
    },
    UpdateExpression: 'SET #matches.#matchId.#result = :result, #matches.#matchId.#status = :status',
    ExpressionAttributeNames: {
      '#matches': 'matches',
      '#matchId': matchId,
      '#result': 'result',
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':result': { winnerId, loserId, submittedAt: new Date().toISOString() },
      ':status': 'COMPLETED'
    }
  }));

  // Trigger leaderboard recalculation
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'tournament.schedule',
      DetailType: 'Tournament Leaderboard Update Required',
      Detail: JSON.stringify({
        eventId,
        scheduleId,
        trigger: 'match_result_submitted',
        timestamp: new Date().toISOString()
      })
    }]
  }));
}

async function handleTournamentAdvanced(eventDetail) {
  const { eventId, scheduleId, filterNumber, advancingAthletes, eliminatedAthletes } = eventDetail;
  
  console.log(`Tournament advanced to filter ${filterNumber + 1}`);

  // Update schedule with advancement results
  await ddb.send(new UpdateCommand({
    TableName: SCHEDULES_TABLE,
    Key: { 
      PK: `EVENT#${eventId}`,
      SK: `SCHEDULE#${scheduleId}`
    },
    UpdateExpression: 'SET #currentFilter = :nextFilter, #advancement.#filter = :advancement',
    ExpressionAttributeNames: {
      '#currentFilter': 'currentFilter',
      '#advancement': 'advancement',
      '#filter': `filter${filterNumber}`
    },
    ExpressionAttributeValues: {
      ':nextFilter': filterNumber + 1,
      ':advancement': {
        advancingAthletes,
        eliminatedAthletes,
        processedAt: new Date().toISOString()
      }
    }
  }));

  // Generate next round matches if tournament continues
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'tournament.schedule',
      DetailType: 'Generate Next Round Matches',
      Detail: JSON.stringify({
        eventId,
        scheduleId,
        filterNumber: filterNumber + 1,
        advancingAthletes,
        timestamp: new Date().toISOString()
      })
    }]
  }));
}

async function handleScoreSubmitted(eventDetail) {
  const { eventId, athleteId, wodId, categoryId, score } = eventDetail;
  
  // Check if this score affects any active tournaments
  const { Items: activeSchedules } = await ddb.send(new QueryCommand({
    TableName: SCHEDULES_TABLE,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: '#published = :published AND #competitionMode = :mode',
    ExpressionAttributeNames: {
      '#published': 'published',
      '#competitionMode': 'competitionMode'
    },
    ExpressionAttributeValues: {
      ':pk': `EVENT#${eventId}`,
      ':published': true,
      ':mode': 'VERSUS'
    }
  }));

  // Trigger tournament leaderboard updates for affected schedules
  for (const schedule of activeSchedules) {
    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'tournament.schedule',
        DetailType: 'Tournament Leaderboard Update Required',
        Detail: JSON.stringify({
          eventId,
          scheduleId: schedule.SK.replace('SCHEDULE#', ''),
          trigger: 'score_submitted',
          athleteId,
          wodId,
          categoryId,
          timestamp: new Date().toISOString()
        })
      }]
    }));
  }
}
