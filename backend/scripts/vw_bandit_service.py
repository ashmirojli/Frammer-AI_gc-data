import vowpalwabbit
import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VW_MODEL_PATH = os.path.join(BASE_DIR, "models", "vw_bandit.model")

# Action space corresponds to our 5 Output Types
# 1: "Full package", 2: "Key moments", 3: "Chapters", 4: "My Key moments", 5: "Summary"
NUM_ACTIONS = 5

class ContextualBanditService:
    def __init__(self):
        # Initialize VW with CB exploration (epsilon-greedy)
        # The bandit starts with exploration. As it learns, it overrules the baseline.
        vw_args = f"--cb_explore {NUM_ACTIONS} --epsilon 0.1 --quiet"
        
        if os.path.exists(VW_MODEL_PATH):
            vw_args += f" -i {VW_MODEL_PATH}"
            
        self.vw = vowpalwabbit.Workspace(vw_args)
        
        # Load Phase 1 global prior
        self.baseline_prior = {}
        baseline_path = os.path.join(BASE_DIR, "models", "historical_baseline.json")
        if os.path.exists(baseline_path):
            with open(baseline_path, 'r') as f:
                self.baseline_prior = {int(k): v for k, v in json.load(f).items()}

    def _format_context(self, inputtype_id: int, duration_sec: int, platform_id: int):
        """Format the context into Vowpal Wabbit string format."""
        # We bucket duration to make it easier for VW to learn
        # e.g., 'short' (<600s), 'medium' (600-1800s), 'long' (>1800s)
        dur_cat = "short"
        if duration_sec > 1800:
            dur_cat = "long"
        elif duration_sec > 600:
            dur_cat = "medium"
            
        return f" |Context input_{inputtype_id} pub_dur_{dur_cat} plat_{platform_id}"

    def get_recommendation(self, inputtype_id: int, duration_sec: int, platform_id: int):
        """Get an action recommendation using Bandit + Baseline Prior."""
        context_str = self._format_context(inputtype_id, duration_sec, platform_id)
        
        try:
            # VW returns [prob_action1, prob_action2, ...]
            vw_probs = self.vw.predict(context_str)
        except Exception as e:
            print(f"VW Predict Error: {e}")
            raise
            
        recommendations = []
        
        # Determine if VW is still totally "cold" (all probabilities exactly equal to 0.2 i.e 1/5)
        # If the bandit hasn't learned anything yet, we use our historical baseline
        is_cold_state = all(abs(p - (1.0/NUM_ACTIONS)) < 0.001 for p in vw_probs)
        
        for i, prob in enumerate(vw_probs):
            action_id = i + 1  # 1-indexed for VW actions
            
            if is_cold_state and self.baseline_prior:
                # Use Phase 1 aggregate probability
                final_prob = self.baseline_prior.get(action_id, 1.0/NUM_ACTIONS)
            else:
                # Use Phase 2 Bandit probability
                final_prob = prob
                
            recommendations.append({
                "output_type_id": action_id,
                "probability": final_prob
            })
            
        # Sort by probability descending
        recommendations.sort(key=lambda x: x["probability"], reverse=True)
        return recommendations

    def log_reward(self, inputtype_id: int, duration_sec: int, platform_id: int, action: int, reward: float, probability: float):
        """
        Feedback loop. When the dashboard user interacts, we tell VW the reward.
        In VW, we pass 'cost' where cost = -reward.
        Format: "action:cost:probability | context"
        """
        cost = -1.0 * reward # VW minimizes cost, so positive reward = negative cost
        context_str = self._format_context(inputtype_id, duration_sec, platform_id)
        
        vw_example = f"{action}:{cost}:{probability}{context_str}"
        self.vw.learn(vw_example)
        
        self._save_model()

    def _save_model(self):
        """Persist the model to disk after learning."""
        if not os.path.exists(os.path.dirname(VW_MODEL_PATH)):
            os.makedirs(os.path.dirname(VW_MODEL_PATH))
        self.vw.save(VW_MODEL_PATH)
