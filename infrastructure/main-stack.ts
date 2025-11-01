import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { SharedStack } from './shared/shared-stack';
import { NetworkStack } from './shared/network-stack';
import { EventRouting } from './shared/event-routing';
import { OrganizationsStack } from './organizations/organizations-stack';
import { CompetitionsStack } from './competitions/competitions-stack';
import { AthletesStack } from './athletes/athletes-stack';
import { ScoringStack } from './scoring/scoring-stack';
import { SchedulingStack } from './scheduling/scheduling-stack';
import { CategoriesStack } from './categories/categories-stack';
import { WodsStack } from './wods/wods-stack';
import { AuthorizationStack } from './authorization/authorization-stack';
import { FrontendStack } from './frontend/frontend-stack';

export interface ScorinGamesStackProps extends cdk.StackProps {
  stage: string;
}

export class ScorinGamesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ScorinGamesStackProps) {
    super(scope, id, props);

    // 1. Shared Infrastructure
    const sharedStack = new SharedStack(this, 'Shared', { stage: props.stage });

    // 2. Network Infrastructure
    const networkStack = new NetworkStack(this, 'Network', {
      stage: props.stage,
      userPool: sharedStack.userPool,
    });

    // 3. Organizations (RBAC foundation)
    const organizationsStack = new OrganizationsStack(this, 'Organizations', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
    });

    // Wire Organizations API routes
    const organizations = networkStack.api.root.addResource('organizations');
    organizations.addMethod('ANY', new apigateway.LambdaIntegration(organizationsStack.organizationsLambda), {
      authorizer: networkStack.authorizer,
    });
    const organizationsProxy = organizations.addResource('{proxy+}');
    organizationsProxy.addMethod('ANY', new apigateway.LambdaIntegration(organizationsStack.organizationsLambda), {
      authorizer: networkStack.authorizer,
    });

    // 4. Domain Stacks
    const scoringStack = new ScoringStack(this, 'Scoring', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
    });

    const competitionsStack = new CompetitionsStack(this, 'Competitions', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
      eventImagesBucket: sharedStack.eventImagesBucket,
      organizationEventsTable: organizationsStack.organizationEventsTable,
      organizationMembersTable: organizationsStack.organizationMembersTable,
      scoringSystemsTable: scoringStack.scoringSystemsTable,
    });

    const athletesStack = new AthletesStack(this, 'Athletes', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
    });

    const schedulingStack = new SchedulingStack(this, 'Scheduling', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
    });

    const categoriesStack = new CategoriesStack(this, 'Categories', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
      organizationEventsTable: organizationsStack.organizationEventsTable,
      organizationMembersTable: organizationsStack.organizationMembersTable,
    });

    const wodsStack = new WodsStack(this, 'Wods', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
      organizationEventsTable: organizationsStack.organizationEventsTable,
      organizationMembersTable: organizationsStack.organizationMembersTable,
      scoresTable: scoringStack.scoresTable,
    });

    const authorizationStack = new AuthorizationStack(this, 'Authorization', {
      stage: props.stage,
      eventBus: sharedStack.eventBus,
    });

    // 5. API Routing (wire Lambdas to API Gateway)
    // Competitions
    const competitions = networkStack.api.root.addResource('competitions');
    competitions.addMethod('ANY', new apigateway.LambdaIntegration(competitionsStack.competitionsLambda), {
      authorizer: networkStack.authorizer,
    });
    competitions.addResource('{proxy+}').addMethod('ANY', 
      new apigateway.LambdaIntegration(competitionsStack.competitionsLambda), 
      { authorizer: networkStack.authorizer }
    );

    // Events (alias for competitions for backward compatibility)
    const events = networkStack.api.root.addResource('events');
    events.addMethod('ANY', new apigateway.LambdaIntegration(competitionsStack.competitionsLambda), {
      authorizer: networkStack.authorizer,
    });
    events.addResource('{proxy+}').addMethod('ANY', 
      new apigateway.LambdaIntegration(competitionsStack.competitionsLambda), 
      { authorizer: networkStack.authorizer }
    );

    // Public events
    const publicRoot = networkStack.api.root.addResource('public');
    const publicEvents = publicRoot.addResource('events');
    publicEvents.addMethod('GET', new apigateway.LambdaIntegration(competitionsStack.competitionsLambda));
    publicEvents.addResource('{proxy+}').addMethod('GET', 
      new apigateway.LambdaIntegration(competitionsStack.competitionsLambda)
    );

    // Public WODs
    const publicWods = publicRoot.addResource('wods');
    publicWods.addMethod('GET', new apigateway.LambdaIntegration(wodsStack.wodsLambda));

    // Athletes
    const athletes = networkStack.api.root.addResource('athletes');
    athletes.addMethod('ANY', new apigateway.LambdaIntegration(athletesStack.athletesLambda), {
      authorizer: networkStack.authorizer,
    });
    athletes.addResource('{proxy+}').addMethod('ANY', 
      new apigateway.LambdaIntegration(athletesStack.athletesLambda), 
      { authorizer: networkStack.authorizer }
    );

    // Scores
    const scores = networkStack.api.root.addResource('scores');
    scores.addMethod('ANY', new apigateway.LambdaIntegration(scoringStack.scoresLambda), {
      authorizer: networkStack.authorizer,
    });

    // Exercises
    const exercises = networkStack.api.root.addResource('exercises');
    exercises.addMethod('ANY', new apigateway.LambdaIntegration(scoringStack.exercisesLambda), {
      authorizer: networkStack.authorizer,
    });

    // Categories
    const categories = networkStack.api.root.addResource('categories');
    categories.addMethod('ANY', new apigateway.LambdaIntegration(categoriesStack.categoriesLambda), {
      authorizer: networkStack.authorizer,
    });
    categories.addResource('{proxy+}').addMethod('ANY', 
      new apigateway.LambdaIntegration(categoriesStack.categoriesLambda), 
      { authorizer: networkStack.authorizer }
    );

    // WODs
    const wods = networkStack.api.root.addResource('wods', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    wods.addMethod('ANY', new apigateway.LambdaIntegration(wodsStack.wodsLambda), {
      authorizer: networkStack.authorizer,
    });

    const wodsProxy = wods.addResource('{proxy+}', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    wodsProxy.addMethod('ANY', new apigateway.LambdaIntegration(wodsStack.wodsLambda), {
      authorizer: networkStack.authorizer,
    });

    // Scheduler
    const scheduler = networkStack.api.root.addResource('scheduler');
    scheduler.addMethod('ANY', new apigateway.LambdaIntegration(schedulingStack.schedulerLambda), {
      authorizer: networkStack.authorizer,
    });
    scheduler.addResource('{proxy+}').addMethod('ANY', 
      new apigateway.LambdaIntegration(schedulingStack.schedulerLambda), 
      { authorizer: networkStack.authorizer }
    );

    // Authorization
    const authorization = networkStack.api.root.addResource('authorization');
    authorization.addMethod('ANY', new apigateway.LambdaIntegration(authorizationStack.authorizationLambda), {
      authorizer: networkStack.authorizer,
    });
    authorization.addResource('{proxy+}').addMethod('ANY', 
      new apigateway.LambdaIntegration(authorizationStack.authorizationLambda), 
      { authorizer: networkStack.authorizer }
    );

    // 6. Cross-Domain Event Routing
    new EventRouting(this, 'EventRouting', {
      centralBus: sharedStack.eventBus,
      competitionsEventBus: competitionsStack.competitionsEventBus,
      organizationsEventBus: organizationsStack.organizationsEventBus,
      athletesEventBus: athletesStack.athletesEventBus,
      scoringEventBus: scoringStack.scoringEventBus,
      schedulingEventBus: schedulingStack.schedulingEventBus,
    });

    // 7. Frontend Stack
    const frontendStack = new FrontendStack(this, 'Frontend', {
      stage: props.stage,
    });

    // Outputs
    new cdk.CfnOutput(this, 'Stage', { value: props.stage });
    new cdk.CfnOutput(this, 'ApiUrl', { value: networkStack.api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: sharedStack.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: sharedStack.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CentralEventBus', { value: sharedStack.eventBus.eventBusName });
    new cdk.CfnOutput(this, 'FrontendBucket', { value: frontendStack.bucket.bucketName });
    new cdk.CfnOutput(this, 'FrontendDistributionId', { value: frontendStack.distribution.distributionId });
    new cdk.CfnOutput(this, 'FrontendUrl', { value: `https://${frontendStack.distribution.distributionDomainName}` });
  }
}
