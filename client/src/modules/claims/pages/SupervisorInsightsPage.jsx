import AnalyticsPage from "../../reports/components/analytics/AnalyticsPage";

// The supervisor portal's Team insights (/supervisor-portal/insights, 17 Nov 2026): Reports &
// Analytics for the classes their educators teach — curriculum coverage, attendance and parent
// check-ins (the server scopes and allows only these — analytics.scope.js / analytics.routes.js).
export default function SupervisorInsightsPage() {
  return <AnalyticsPage level="supervisor" title="Team insights" />;
}
