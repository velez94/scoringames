"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkStack = void 0;
const apigateway = require("aws-cdk-lib/aws-apigateway");
const constructs_1 = require("constructs");
class NetworkStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // API Gateway
        this.api = new apigateway.RestApi(this, 'Api', {
            restApiName: `scoringames-api-${props.stage}`,
            description: 'ScorinGames API',
            deployOptions: {
                stageName: props.stage,
                tracingEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        // Cognito Authorizer
        this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
            cognitoUserPools: [props.userPool],
            authorizerName: 'CognitoAuthorizer',
        });
        // Add CORS headers to Gateway error responses
        this.api.addGatewayResponse('Unauthorized', {
            type: apigateway.ResponseType.UNAUTHORIZED,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",
                'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse('AccessDenied', {
            type: apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",
                'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
            },
        });
        this.api.addGatewayResponse('Default4xx', {
            type: apigateway.ResponseType.DEFAULT_4XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",
                'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
            },
        });
        // Outputs
    }
}
exports.NetworkStack = NetworkStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29yay1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ldHdvcmstc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EseURBQXlEO0FBRXpELDJDQUF1QztBQU92QyxNQUFhLFlBQWEsU0FBUSxzQkFBUztJQUl6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXdCO1FBQ2hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsY0FBYztRQUNkLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDN0MsV0FBVyxFQUFFLG1CQUFtQixLQUFLLENBQUMsS0FBSyxFQUFFO1lBQzdDLFdBQVcsRUFBRSxpQkFBaUI7WUFDOUIsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxLQUFLLENBQUMsS0FBSztnQkFDdEIsY0FBYyxFQUFFLElBQUk7YUFDckI7WUFDRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDekMsWUFBWSxFQUFFLENBQUMsY0FBYyxFQUFFLGVBQWUsQ0FBQzthQUNoRDtTQUNGLENBQUMsQ0FBQztRQUVILHFCQUFxQjtRQUNyQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLDBCQUEwQixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDOUUsZ0JBQWdCLEVBQUUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO1lBQ2xDLGNBQWMsRUFBRSxtQkFBbUI7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsOENBQThDO1FBQzlDLElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsY0FBYyxFQUFFO1lBQzFDLElBQUksRUFBRSxVQUFVLENBQUMsWUFBWSxDQUFDLFlBQVk7WUFDMUMsZUFBZSxFQUFFO2dCQUNmLDZCQUE2QixFQUFFLEtBQUs7Z0JBQ3BDLDhCQUE4QixFQUFFLDhCQUE4QjthQUMvRDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsY0FBYyxFQUFFO1lBQzFDLElBQUksRUFBRSxVQUFVLENBQUMsWUFBWSxDQUFDLGFBQWE7WUFDM0MsZUFBZSxFQUFFO2dCQUNmLDZCQUE2QixFQUFFLEtBQUs7Z0JBQ3BDLDhCQUE4QixFQUFFLDhCQUE4QjthQUMvRDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsWUFBWSxFQUFFO1lBQ3hDLElBQUksRUFBRSxVQUFVLENBQUMsWUFBWSxDQUFDLFdBQVc7WUFDekMsZUFBZSxFQUFFO2dCQUNmLDZCQUE2QixFQUFFLEtBQUs7Z0JBQ3BDLDhCQUE4QixFQUFFLDhCQUE4QjthQUMvRDtTQUNGLENBQUMsQ0FBQztRQUVILFVBQVU7SUFDWixDQUFDO0NBQ0Y7QUF2REQsb0NBdURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBOZXR3b3JrU3RhY2tQcm9wcyAge1xuICBzdGFnZTogc3RyaW5nO1xuICB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbn1cblxuZXhwb3J0IGNsYXNzIE5ldHdvcmtTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXI7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE5ldHdvcmtTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHNjb3JpbmdhbWVzLWFwaS0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Njb3JpbkdhbWVzIEFQSScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogcHJvcHMuc3RhZ2UsXG4gICAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENvZ25pdG8gQXV0aG9yaXplclxuICAgIHRoaXMuYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdBdXRob3JpemVyJywge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3Byb3BzLnVzZXJQb29sXSxcbiAgICAgIGF1dGhvcml6ZXJOYW1lOiAnQ29nbml0b0F1dGhvcml6ZXInLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIENPUlMgaGVhZGVycyB0byBHYXRld2F5IGVycm9yIHJlc3BvbnNlc1xuICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZSgnVW5hdXRob3JpemVkJywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuVU5BVVRIT1JJWkVELFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJ1wiLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYXBpLmFkZEdhdGV3YXlSZXNwb25zZSgnQWNjZXNzRGVuaWVkJywge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQUNDRVNTX0RFTklFRCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIixcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidcIixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFwaS5hZGRHYXRld2F5UmVzcG9uc2UoJ0RlZmF1bHQ0eHgnLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5ERUZBVUxUXzRYWCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIixcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbidcIixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gIH1cbn1cbiJdfQ==