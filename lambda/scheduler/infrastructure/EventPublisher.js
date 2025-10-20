const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

class EventPublisher {
  constructor(eventBusName = 'default') {
    this.eventBridge = new EventBridgeClient({});
    this.eventBusName = eventBusName;
    this.source = 'schedule.service';
  }

  async publish(domainEvent) {
    const event = {
      Source: this.source,
      DetailType: domainEvent.eventType,
      Detail: JSON.stringify(domainEvent),
      EventBusName: this.eventBusName,
      Time: new Date()
    };

    try {
      await this.eventBridge.send(new PutEventsCommand({
        Entries: [event]
      }));
      
      console.log('Domain event published:', domainEvent.eventType);
    } catch (error) {
      console.error('Failed to publish domain event:', error);
      // In production, you might want to store failed events for retry
    }
  }

  async publishBatch(domainEvents) {
    const entries = domainEvents.map(domainEvent => ({
      Source: this.source,
      DetailType: domainEvent.eventType,
      Detail: JSON.stringify(domainEvent),
      EventBusName: this.eventBusName,
      Time: new Date()
    }));

    try {
      await this.eventBridge.send(new PutEventsCommand({ Entries: entries }));
      console.log(`Published ${entries.length} domain events`);
    } catch (error) {
      console.error('Failed to publish domain events:', error);
    }
  }
}

module.exports = { EventPublisher };
