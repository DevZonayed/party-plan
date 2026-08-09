import { ChatPlanner } from "@/components/chat-planner";

export const metadata = {
  title: "Plan a Party — Chat with Pippa, your AI Party Planner",
  description:
    "Chat naturally with Pippa, the AI party planner, or use quick suggestions to get a complete, budget-balanced shopping plan from real party supplies.",
};

export default function PlanPage() {
  return (
    <main className="container-pp py-6">
      <ChatPlanner />
    </main>
  );
}
