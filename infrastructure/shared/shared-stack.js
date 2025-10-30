"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const s3 = require("aws-cdk-lib/aws-s3");
const events = require("aws-cdk-lib/aws-events");
const constructs_1 = require("constructs");
class SharedStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Cognito User Pool
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: `scoringames-${props.stage}`,
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            standardAttributes: {
                email: { required: true, mutable: true },
                givenName: { required: true, mutable: true },
                familyName: { required: true, mutable: true },
            },
            customAttributes: {
                role: new cognito.StringAttribute({ mutable: true }),
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        this.userPoolClient = this.userPool.addClient('UserPoolClient', {
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            generateSecret: false,
        });
        // Central EventBridge Bus for cross-domain events
        this.eventBus = new events.EventBus(this, 'CentralEventBus', {
            eventBusName: `scoringames-central-${props.stage}`,
        });
        // S3 Bucket for event images
        this.eventImagesBucket = new s3.Bucket(this, 'EventImagesBucket', {
            bucketName: `scoringames-event-images-${props.stage}`,
            cors: [{
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                }],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // Outputs
    }
}
exports.SharedStack = SharedStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2hhcmVkLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxtREFBbUQ7QUFDbkQseUNBQXlDO0FBQ3pDLGlEQUFpRDtBQUNqRCwyQ0FBdUM7QUFNdkMsTUFBYSxXQUFZLFNBQVEsc0JBQVM7SUFNeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLG9CQUFvQjtRQUNwQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ3JELFlBQVksRUFBRSxlQUFlLEtBQUssQ0FBQyxLQUFLLEVBQUU7WUFDMUMsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO1lBQzlCLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDM0Isa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtnQkFDeEMsU0FBUyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2dCQUM1QyxVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDOUM7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDaEIsSUFBSSxFQUFFLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQzthQUNyRDtZQUNELGNBQWMsRUFBRTtnQkFDZCxTQUFTLEVBQUUsQ0FBQztnQkFDWixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixhQUFhLEVBQUUsSUFBSTtnQkFDbkIsY0FBYyxFQUFFLEtBQUs7YUFDdEI7WUFDRCxlQUFlLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxVQUFVO1lBQ25ELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07U0FDeEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsRUFBRTtZQUM5RCxTQUFTLEVBQUU7Z0JBQ1QsWUFBWSxFQUFFLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRSxJQUFJO2FBQ2Q7WUFDRCxjQUFjLEVBQUUsS0FBSztTQUN0QixDQUFDLENBQUM7UUFFSCxrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzNELFlBQVksRUFBRSx1QkFBdUIsS0FBSyxDQUFDLEtBQUssRUFBRTtTQUNuRCxDQUFDLENBQUM7UUFFSCw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDaEUsVUFBVSxFQUFFLDRCQUE0QixLQUFLLENBQUMsS0FBSyxFQUFFO1lBQ3JELElBQUksRUFBRSxDQUFDO29CQUNMLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO29CQUM3RSxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7b0JBQ3JCLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztpQkFDdEIsQ0FBQztZQUNGLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDeEMsaUJBQWlCLEVBQUUsSUFBSTtTQUN4QixDQUFDLENBQUM7UUFFSCxVQUFVO0lBQ1osQ0FBQztDQUNGO0FBN0RELGtDQTZEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBTaGFyZWRTdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFNoYXJlZFN0YWNrIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQ7XG4gIHB1YmxpYyByZWFkb25seSBldmVudEJ1czogZXZlbnRzLkV2ZW50QnVzO1xuICBwdWJsaWMgcmVhZG9ubHkgZXZlbnRJbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2hhcmVkU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbFxuICAgIHRoaXMudXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IGBzY29yaW5nYW1lcy0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgICBnaXZlbk5hbWU6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcbiAgICAgICAgZmFtaWx5TmFtZTogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcbiAgICAgICAgcm9sZTogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbXV0YWJsZTogdHJ1ZSB9KSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG5cbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gdGhpcy51c2VyUG9vbC5hZGRDbGllbnQoJ1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBDZW50cmFsIEV2ZW50QnJpZGdlIEJ1cyBmb3IgY3Jvc3MtZG9tYWluIGV2ZW50c1xuICAgIHRoaXMuZXZlbnRCdXMgPSBuZXcgZXZlbnRzLkV2ZW50QnVzKHRoaXMsICdDZW50cmFsRXZlbnRCdXMnLCB7XG4gICAgICBldmVudEJ1c05hbWU6IGBzY29yaW5nYW1lcy1jZW50cmFsLSR7cHJvcHMuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgZXZlbnQgaW1hZ2VzXG4gICAgdGhpcy5ldmVudEltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0V2ZW50SW1hZ2VzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHNjb3JpbmdhbWVzLWV2ZW50LWltYWdlcy0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICBjb3JzOiBbe1xuICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NUXSxcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICB9XSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgfVxufVxuIl19