// ❌ NOT RECOMMENDED - Use direct object passing instead
// This is an example of ARN-based cross-stack references

import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

// Shared Stack with ARN exports
export class SharedStackWithArns extends cdk.Stack {
  public readonly eventBusArn: string;
  public readonly eventBusName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: 'scoringames-central',
    });

    // Export ARNs
    this.eventBusArn = eventBus.eventBusArn;
    this.eventBusName = eventBus.eventBusName;

    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBusArn,
      exportName: 'ScorinGames-EventBusArn',
    });
  }
}

// Competitions Stack with ARN imports
export interface CompetitionsStackWithArnsProps extends cdk.StackProps {
  eventBusArn: string;
  eventBusName: string;
  organizationEventsTableName: string;
  organizationEventsTableArn: string;
}

export class CompetitionsStackWithArns extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CompetitionsStackWithArnsProps) {
    super(scope, id, props);

    // Import EventBus from ARN
    const eventBus = events.EventBus.fromEventBusArn(
      this,
      'ImportedEventBus',
      props.eventBusArn
    );

    // Import DynamoDB table from attributes
    const organizationEventsTable = dynamodb.Table.fromTableAttributes(
      this,
      'ImportedOrgEventsTable',
      {
        tableName: props.organizationEventsTableName,
        tableArn: props.organizationEventsTableArn,
      }
    );

    // Use imported resources
    eventBus.grantPutEventsTo(/* lambda */);
    organizationEventsTable.grantReadData(/* lambda */);
  }
}

// Main Stack with ARN passing
export class MainStackWithArns extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sharedStack = new SharedStackWithArns(this, 'Shared');
    
    const competitionsStack = new CompetitionsStackWithArns(this, 'Competitions', {
      eventBusArn: sharedStack.eventBusArn,
      eventBusName: sharedStack.eventBusName,
      organizationEventsTableName: 'org-events-table',
      organizationEventsTableArn: 'arn:aws:dynamodb:...',
    });

    competitionsStack.addDependency(sharedStack);
  }
}

// ❌ Problems with this approach:
// 1. More boilerplate code
// 2. Need to pass both ARN and name for some resources
// 3. Less type-safe
// 4. Manual dependency management
// 5. Harder to refactor

// ✅ Current implementation (direct object passing) is better!
