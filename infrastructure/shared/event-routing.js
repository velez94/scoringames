"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRouting = void 0;
const events = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
const constructs_1 = require("constructs");
class EventRouting extends constructs_1.Construct {
    constructor(scope, id, props) {
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
exports.EventRouting = EventRouting;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtcm91dGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImV2ZW50LXJvdXRpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsaURBQWlEO0FBQ2pELDBEQUEwRDtBQUMxRCwyQ0FBdUM7QUFXdkMsTUFBYSxZQUFhLFNBQVEsc0JBQVM7SUFDekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLDhDQUE4QztRQUM5QyxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxLQUFLLENBQUMsZ0JBQWdCLElBQUksS0FBSyxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDckYsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtnQkFDeEMsUUFBUSxFQUFFLEtBQUssQ0FBQyxvQkFBb0I7Z0JBQ3BDLFlBQVksRUFBRTtvQkFDWixNQUFNLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztvQkFDL0IsVUFBVSxFQUFFLENBQUMsY0FBYyxFQUFFLGdCQUFnQixDQUFDO2lCQUMvQztnQkFDRCxPQUFPLEVBQUU7b0JBQ1AsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQztvQkFDNUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztvQkFDOUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUM7aUJBQ3ZDO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELHVEQUF1RDtRQUN2RCxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsSUFBSSxLQUFLLENBQUMsb0JBQW9CLElBQUksS0FBSyxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDckYsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtnQkFDN0Ms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ZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXZlbnRSb3V0aW5nUHJvcHMge1xuICBjZW50cmFsQnVzOiBldmVudHMuRXZlbnRCdXM7XG4gIGNvbXBldGl0aW9uc0V2ZW50QnVzPzogZXZlbnRzLkV2ZW50QnVzO1xuICBvcmdhbml6YXRpb25zRXZlbnRCdXM/OiBldmVudHMuRXZlbnRCdXM7XG4gIGF0aGxldGVzRXZlbnRCdXM/OiBldmVudHMuRXZlbnRCdXM7XG4gIHNjb3JpbmdFdmVudEJ1cz86IGV2ZW50cy5FdmVudEJ1cztcbiAgc2NoZWR1bGluZ0V2ZW50QnVzPzogZXZlbnRzLkV2ZW50QnVzO1xufVxuXG5leHBvcnQgY2xhc3MgRXZlbnRSb3V0aW5nIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEV2ZW50Um91dGluZ1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIEV2ZW50IENyZWF0ZWQg4oaSIE5vdGlmeSBBdGhsZXRlcywgU2NoZWR1bGluZ1xuICAgIGlmIChwcm9wcy5jb21wZXRpdGlvbnNFdmVudEJ1cyAmJiBwcm9wcy5hdGhsZXRlc0V2ZW50QnVzICYmIHByb3BzLnNjaGVkdWxpbmdFdmVudEJ1cykge1xuICAgICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdFdmVudENyZWF0ZWRSdWxlJywge1xuICAgICAgICBldmVudEJ1czogcHJvcHMuY29tcGV0aXRpb25zRXZlbnRCdXMsXG4gICAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICAgIHNvdXJjZTogWydjb21wZXRpdGlvbnMuZG9tYWluJ10sXG4gICAgICAgICAgZGV0YWlsVHlwZTogWydFdmVudENyZWF0ZWQnLCAnRXZlbnRQdWJsaXNoZWQnXSxcbiAgICAgICAgfSxcbiAgICAgICAgdGFyZ2V0czogW1xuICAgICAgICAgIG5ldyB0YXJnZXRzLkV2ZW50QnVzKHByb3BzLmF0aGxldGVzRXZlbnRCdXMpLFxuICAgICAgICAgIG5ldyB0YXJnZXRzLkV2ZW50QnVzKHByb3BzLnNjaGVkdWxpbmdFdmVudEJ1cyksXG4gICAgICAgICAgbmV3IHRhcmdldHMuRXZlbnRCdXMocHJvcHMuY2VudHJhbEJ1cyksXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBdGhsZXRlIFJlZ2lzdGVyZWQg4oaSIE5vdGlmeSBDb21wZXRpdGlvbnMsIFNjaGVkdWxpbmdcbiAgICBpZiAocHJvcHMuYXRobGV0ZXNFdmVudEJ1cyAmJiBwcm9wcy5jb21wZXRpdGlvbnNFdmVudEJ1cyAmJiBwcm9wcy5zY2hlZHVsaW5nRXZlbnRCdXMpIHtcbiAgICAgIG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQXRobGV0ZVJlZ2lzdGVyZWRSdWxlJywge1xuICAgICAgICBldmVudEJ1czogcHJvcHMuYXRobGV0ZXNFdmVudEJ1cyxcbiAgICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgICAgc291cmNlOiBbJ2F0aGxldGVzLmRvbWFpbiddLFxuICAgICAgICAgIGRldGFpbFR5cGU6IFsnQXRobGV0ZVJlZ2lzdGVyZWQnLCAnQXRobGV0ZVVucmVnaXN0ZXJlZCddLFxuICAgICAgICB9LFxuICAgICAgICB0YXJnZXRzOiBbXG4gICAgICAgICAgbmV3IHRhcmdldHMuRXZlbnRCdXMocHJvcHMuY29tcGV0aXRpb25zRXZlbnRCdXMpLFxuICAgICAgICAgIG5ldyB0YXJnZXRzLkV2ZW50QnVzKHByb3BzLnNjaGVkdWxpbmdFdmVudEJ1cyksXG4gICAgICAgICAgbmV3IHRhcmdldHMuRXZlbnRCdXMocHJvcHMuY2VudHJhbEJ1cyksXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTY29yZSBTdWJtaXR0ZWQg4oaSIE5vdGlmeSBDb21wZXRpdGlvbnMsIFNjaGVkdWxpbmdcbiAgICBpZiAocHJvcHMuc2NvcmluZ0V2ZW50QnVzICYmIHByb3BzLmNvbXBldGl0aW9uc0V2ZW50QnVzICYmIHByb3BzLnNjaGVkdWxpbmdFdmVudEJ1cykge1xuICAgICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdTY29yZVN1Ym1pdHRlZFJ1bGUnLCB7XG4gICAgICAgIGV2ZW50QnVzOiBwcm9wcy5zY29yaW5nRXZlbnRCdXMsXG4gICAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICAgIHNvdXJjZTogWydzY29yaW5nLmRvbWFpbiddLFxuICAgICAgICAgIGRldGFpbFR5cGU6IFsnU2NvcmVTdWJtaXR0ZWQnLCAnU2NvcmVDYWxjdWxhdGVkJ10sXG4gICAgICAgIH0sXG4gICAgICAgIHRhcmdldHM6IFtcbiAgICAgICAgICBuZXcgdGFyZ2V0cy5FdmVudEJ1cyhwcm9wcy5jb21wZXRpdGlvbnNFdmVudEJ1cyksXG4gICAgICAgICAgbmV3IHRhcmdldHMuRXZlbnRCdXMocHJvcHMuc2NoZWR1bGluZ0V2ZW50QnVzKSxcbiAgICAgICAgICBuZXcgdGFyZ2V0cy5FdmVudEJ1cyhwcm9wcy5jZW50cmFsQnVzKSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE9yZ2FuaXphdGlvbiBNZW1iZXIgQWRkZWQg4oaSIE5vdGlmeSBDb21wZXRpdGlvbnNcbiAgICBpZiAocHJvcHMub3JnYW5pemF0aW9uc0V2ZW50QnVzICYmIHByb3BzLmNvbXBldGl0aW9uc0V2ZW50QnVzKSB7XG4gICAgICBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ01lbWJlckFkZGVkUnVsZScsIHtcbiAgICAgICAgZXZlbnRCdXM6IHByb3BzLm9yZ2FuaXphdGlvbnNFdmVudEJ1cyxcbiAgICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgICAgc291cmNlOiBbJ29yZ2FuaXphdGlvbnMuZG9tYWluJ10sXG4gICAgICAgICAgZGV0YWlsVHlwZTogWydNZW1iZXJBZGRlZCcsICdNZW1iZXJSZW1vdmVkJywgJ1JvbGVDaGFuZ2VkJ10sXG4gICAgICAgIH0sXG4gICAgICAgIHRhcmdldHM6IFtcbiAgICAgICAgICBuZXcgdGFyZ2V0cy5FdmVudEJ1cyhwcm9wcy5jb21wZXRpdGlvbnNFdmVudEJ1cyksXG4gICAgICAgICAgbmV3IHRhcmdldHMuRXZlbnRCdXMocHJvcHMuY2VudHJhbEJ1cyksXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTY2hlZHVsZSBHZW5lcmF0ZWQg4oaSIE5vdGlmeSBDb21wZXRpdGlvbnMsIEF0aGxldGVzXG4gICAgaWYgKHByb3BzLnNjaGVkdWxpbmdFdmVudEJ1cyAmJiBwcm9wcy5jb21wZXRpdGlvbnNFdmVudEJ1cyAmJiBwcm9wcy5hdGhsZXRlc0V2ZW50QnVzKSB7XG4gICAgICBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1NjaGVkdWxlR2VuZXJhdGVkUnVsZScsIHtcbiAgICAgICAgZXZlbnRCdXM6IHByb3BzLnNjaGVkdWxpbmdFdmVudEJ1cyxcbiAgICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgICAgc291cmNlOiBbJ3NjaGVkdWxpbmcuZG9tYWluJ10sXG4gICAgICAgICAgZGV0YWlsVHlwZTogWydTY2hlZHVsZUdlbmVyYXRlZCcsICdTY2hlZHVsZVB1Ymxpc2hlZCddLFxuICAgICAgICB9LFxuICAgICAgICB0YXJnZXRzOiBbXG4gICAgICAgICAgbmV3IHRhcmdldHMuRXZlbnRCdXMocHJvcHMuY29tcGV0aXRpb25zRXZlbnRCdXMpLFxuICAgICAgICAgIG5ldyB0YXJnZXRzLkV2ZW50QnVzKHByb3BzLmF0aGxldGVzRXZlbnRCdXMpLFxuICAgICAgICAgIG5ldyB0YXJnZXRzLkV2ZW50QnVzKHByb3BzLmNlbnRyYWxCdXMpLFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iXX0=