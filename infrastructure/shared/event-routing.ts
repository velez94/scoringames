import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface EventRoutingProps {
  centralBus: events.EventBus;
  competitionsEventBus?: events.EventBus;
  organizationsEventBus?: events.EventBus;
  athletesEventBus?: events.EventBus;
  scoringEventBus?: events.EventBus;
  schedulingEventBus?: events.EventBus;
}

export class EventRouting extends Construct {
  constructor(scope: Construct, id: string, props: EventRoutingProps) {
    super(scope, id);

    // Event Created → Notify Athletes, Scheduling
    if (props.competitionsEventBus && props.athletesEventBus && props.schedulingEventBus) {
      new events.Rule(this, 'EventCreatedRule', {
        eventBus: props.competitionsEventBus,
        eventPattern: {
          source: ['competitions.domain'],
          detailType: ['EventCreated', 'EventPublished'],
        },
        targets: [
          new targets.EventBus(props.athletesEventBus),
          new targets.EventBus(props.schedulingEventBus),
          new targets.EventBus(props.centralBus),
        ],
      });
    }

    // Athlete Registered → Notify Competitions, Scheduling
    if (props.athletesEventBus && props.competitionsEventBus && props.schedulingEventBus) {
      new events.Rule(this, 'AthleteRegisteredRule', {
        eventBus: props.athletesEventBus,
        eventPattern: {
          source: ['athletes.domain'],
          detailType: ['AthleteRegistered', 'AthleteUnregistered'],
        },
        targets: [
          new targets.EventBus(props.competitionsEventBus),
          new targets.EventBus(props.schedulingEventBus),
          new targets.EventBus(props.centralBus),
        ],
      });
    }

    // Score Submitted → Notify Competitions, Scheduling
    if (props.scoringEventBus && props.competitionsEventBus && props.schedulingEventBus) {
      new events.Rule(this, 'ScoreSubmittedRule', {
        eventBus: props.scoringEventBus,
        eventPattern: {
          source: ['scoring.domain'],
          detailType: ['ScoreSubmitted', 'ScoreCalculated'],
        },
        targets: [
          new targets.EventBus(props.competitionsEventBus),
          new targets.EventBus(props.schedulingEventBus),
          new targets.EventBus(props.centralBus),
        ],
      });
    }

    // Organization Member Added → Notify Competitions
    if (props.organizationsEventBus && props.competitionsEventBus) {
      new events.Rule(this, 'MemberAddedRule', {
        eventBus: props.organizationsEventBus,
        eventPattern: {
          source: ['organizations.domain'],
          detailType: ['MemberAdded', 'MemberRemoved', 'RoleChanged'],
        },
        targets: [
          new targets.EventBus(props.competitionsEventBus),
          new targets.EventBus(props.centralBus),
        ],
      });
    }

    // Schedule Generated → Notify Competitions, Athletes
    if (props.schedulingEventBus && props.competitionsEventBus && props.athletesEventBus) {
      new events.Rule(this, 'ScheduleGeneratedRule', {
        eventBus: props.schedulingEventBus,
        eventPattern: {
          source: ['scheduling.domain'],
          detailType: ['ScheduleGenerated', 'SchedulePublished'],
        },
        targets: [
          new targets.EventBus(props.competitionsEventBus),
          new targets.EventBus(props.athletesEventBus),
          new targets.EventBus(props.centralBus),
        ],
      });
    }
  }
}
