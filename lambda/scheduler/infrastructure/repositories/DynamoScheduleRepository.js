const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ScheduleRepository } = require('../../domain/repositories/ScheduleRepository');
const { Schedule } = require('../../domain/entities/Schedule');

class DynamoScheduleRepository extends ScheduleRepository {
  constructor(dynamoClient, tableName) {
    super();
    this.dynamodb = dynamoClient;
    this.tableName = tableName;
  }

  async save(schedule) {
    const item = {
      eventId: schedule.eventId,
      scheduleId: schedule.scheduleId.toString(),
      ...schedule.toSnapshot(),
      updatedAt: new Date().toISOString()
    };

    await this.dynamodb.send(new PutCommand({
      TableName: this.tableName,
      Item: item
    }));

    return schedule;
  }

  async findById(eventId, scheduleId) {
    const { Item } = await this.dynamodb.send(new GetCommand({
      TableName: this.tableName,
      Key: { eventId, scheduleId }
    }));

    return Item ? Schedule.fromSnapshot(Item) : null;
  }

  async findByEventId(eventId) {
    const { Items } = await this.dynamodb.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId }
    }));

    return (Items || []).map(item => Schedule.fromSnapshot(item));
  }

  async findPublishedByEventId(eventId) {
    const { Items } = await this.dynamodb.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'eventId = :eventId',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { 
        ':eventId': eventId,
        ':status': 'PUBLISHED'
      }
    }));

    return (Items || []).map(item => Schedule.fromSnapshot(item));
  }

  async delete(eventId, scheduleId) {
    await this.dynamodb.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { eventId, scheduleId }
    }));
  }
}

module.exports = { DynamoScheduleRepository };
