import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface EventRoutingProps {
    centralBus: events.EventBus;
    competitionsEventBus?: events.EventBus;
    organizationsEventBus?: events.EventBus;
    athletesEventBus?: events.EventBus;
    scoringEventBus?: events.EventBus;
    schedulingEventBus?: events.EventBus;
}
export declare class EventRouting extends Construct {
    constructor(scope: Construct, id: string, props: EventRoutingProps);
}
