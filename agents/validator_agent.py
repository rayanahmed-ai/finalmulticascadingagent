from injection_detector import InjectionDetectorAgent
from blocking_test import MessageBlocker
from normalizer import Normalizer

class ValidatorAgent():
    def __init__(self, messages):
        self.messages = messages
        self.norm_message = self.normalizer(messages)

        # Unified safety check via Groq Llama 3.1
        self.safety_detector = InjectionDetectorAgent()
        self.safety_results = self.safety_detector.finalized(self.norm_message)

        # Regex-based blocker for instant rejection of known patterns
        self.message_blocker = self.get_validator_response(self.norm_message)

    def normalizer(self, message):
        return Normalizer().normalize(message)

    def get_validator_response(self, message):
        return MessageBlocker().check(message)

    def finalized_values(self):
        return {
            "Message_blocker": self.message_blocker,
            "injection_detector": {
                "jailbreak": self.safety_results.get("jailbreak", False),
                "score": self.safety_results.get("score", 0.0)
            },
            "toxic_bert_classifier": {
                "blocked": self.safety_results.get("is_toxic", False)
            },
            "nsfw_detector": {
                "is_nsfw": self.safety_results.get("is_nsfw", False)
            },
            "transformer_classifer": {
                "blocked": False # Legacy support
            },
            "message": self.messages,
            "timestamp": "instant",
            "tokens_used": "N/A"
        }