import { DatePlannerApp } from "@/components/date-planner-app";
import { getPlannerState, getScenarioSummaries } from "@/lib/planner";

export default function HomePage() {
  const initialPlanner = getPlannerState({ scenarioId: "afterwork", mode: "j" });
  const scenarios = getScenarioSummaries();

  return <DatePlannerApp initialPlanner={initialPlanner} scenarios={scenarios} />;
}
