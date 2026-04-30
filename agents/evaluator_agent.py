import time
from validator_agent import ValidatorAgent
class EvaluatorAgent:
    def __init__(self, messages):
        self.start_time = time.time()
        self.validator_output = ValidatorAgent(messages).finalized_values()
    def evaluate(self):
        start_time = self.start_time

        blocked_agents = []
        for agent_name, result in self.validator_output.items():
            if not isinstance(result, dict):
                continue
                
            # Check for various blocking keys used by different agents
            is_blocked = result.get("blocked", False) or result.get("is_nsfw", False)
            
            if is_blocked:
                blocked_agents.append(agent_name)
        

        if not blocked_agents:
            risk = "low"
            reason = "All validators approved"
        elif len(blocked_agents) == 1:
            risk = "medium"
            reason = f"Blocked by {blocked_agents[0]}"
        else:
            risk = "high"
            reason = f"Blocked by multiple agents: {', '.join(blocked_agents)}"

        return {
            "risk_level": risk,
            "reason": reason,
            "blocked_agents": blocked_agents,
            "message": self.validator_output.get("message", ""),
            "timestamp": f"{time.time() - start_time:.3f}s"
        }

if __name__ == "__main__":
    evaluator_agent=EvaluatorAgent(messages="nigger")
    print(evaluator_agent.evaluate())
