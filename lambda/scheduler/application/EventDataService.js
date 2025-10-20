const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class EventDataService {
  constructor(dynamoClient) {
    this.dynamodb = dynamoClient;
    this.eventsTable = process.env.EVENTS_TABLE;
    this.eventDaysTable = process.env.EVENT_DAYS_TABLE;
    this.categoriesTable = process.env.CATEGORIES_TABLE;
    this.wodsTable = process.env.WODS_TABLE;
    this.athleteEventsTable = process.env.ATHLETE_EVENTS_TABLE;
    this.athletesTable = process.env.ATHLETES_TABLE;
  }

  async getEventData(eventId) {
    const [event, days, categories, wods, athletes] = await Promise.all([
      this._getEvent(eventId),
      this._getEventDays(eventId),
      this._getCategories(eventId),
      this._getWods(eventId),
      this._getRegisteredAthletes(eventId)
    ]);

    // Auto-generate days if none exist
    if (days.length === 0 && event.startDate && event.endDate) {
      days.push(...this._generateDaysFromEvent(event));
    }

    this._validateEventData(event, days, categories, wods, athletes);

    return { event, days, categories, wods, athletes };
  }

  async _getEvent(eventId) {
    const { Item } = await this.dynamodb.send(new GetCommand({
      TableName: this.eventsTable,
      Key: { eventId }
    }));
    
    if (!Item) throw new Error(`Event ${eventId} not found`);
    return Item;
  }

  async _getEventDays(eventId) {
    const { Items } = await this.dynamodb.send(new QueryCommand({
      TableName: this.eventDaysTable,
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));
    
    return Items || [];
  }

  async _getCategories(eventId) {
    const { Items } = await this.dynamodb.send(new QueryCommand({
      TableName: this.categoriesTable,
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));
    
    return Items || [];
  }

  async _getWods(eventId) {
    const { Items } = await this.dynamodb.send(new QueryCommand({
      TableName: this.wodsTable,
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));
    
    return Items || [];
  }

  async _getRegisteredAthletes(eventId) {
    const { Items: registrations } = await this.dynamodb.send(new QueryCommand({
      TableName: this.athleteEventsTable,
      IndexName: 'event-athletes-index',
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));

    if (!registrations || registrations.length === 0) return [];

    // Get athlete details
    const athletes = [];
    for (const registration of registrations) {
      const { Item: athlete } = await this.dynamodb.send(new GetCommand({
        TableName: this.athletesTable,
        Key: { userId: registration.userId }
      }));
      
      if (athlete) {
        athletes.push({
          ...athlete,
          categoryId: registration.categoryId
        });
      }
    }

    return athletes;
  }

  _generateDaysFromEvent(event) {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const days = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayId = `day-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        dayId,
        name: `Day ${days.length + 1}`,
        date: d.toISOString().split('T')[0],
        eventId
      });
    }
    
    return days;
  }

  _validateEventData(event, days, categories, wods, athletes) {
    if (days.length === 0) {
      throw new Error('No event days found. Please create event days first.');
    }
    if (wods.length === 0) {
      throw new Error('No WODs found. Please add WODs to the event first.');
    }
    if (categories.length === 0) {
      throw new Error('No categories found. Please add categories to the event first.');
    }
    if (athletes.length === 0) {
      throw new Error('No registered athletes found. Please ensure athletes are registered for this event.');
    }
  }
}

module.exports = { EventDataService };
