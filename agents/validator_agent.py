from injection_detector import InjectionDetectorAgent
from blocking_test import MessageBlocker
from normalizer import Normalizer
# from transformer import TransformerClassifierAgent
from injection_detector import InjectionDetectorAgent
from toxicbert_classifier import ToxicBertClassifier
from nsfw_detector import NSFWDetector
class ValidatorAgent():
    def __init__(self,messages):
        self.messages = messages

        self.injection_detector = InjectionDetectorAgent(messages)
        self.injection_detector_finalized=self.injection_detector.finalized(messages)

        self.toxic_bert_classifier = ToxicBertClassifier(messages)
        self.toxic_bert_classifier = self.toxic_bert_classifier.check_toxicity(messages)

        # self.transformer_classifer = self.transformer(messages)
        self.transformer_classifer = {"blocked": False} # Covered by Llama Guard API
        
        self.nsfw_detector = NSFWDetector(messages)
        self.nsfw_result = self.nsfw_detector.check_nsfw(self.normalizer(messages))
        
        self.message_blocker = self.get_validator_response(messages)

    def normalizer(self,message):
        normalizer=Normalizer()
        return normalizer.normalize(message)

    def get_validator_response(self,message):
        blocker=MessageBlocker()
        return blocker.check(self.normalizer(message))

    def transformer(self,message):
        transformer=TransformerClassifierAgent(message)
        return transformer.process(self.normalizer(message))

    def finalized_values(self):
        dict1=dict()
        dict1["Message_blocker"]=self.message_blocker
        dict1["injection_detector"]=self.injection_detector_finalized
        dict1["transformer_classifer"]=self.transformer_classifer
        dict2=dict()
        dict2["blocked"]=self.toxic_bert_classifier
        dict1["toxic_bert_classifier"]=dict2
        dict1["nsfw_detector"]=self.nsfw_result
        dict1['message']=self.messages
        dict1['timestamp']="instant"
        dict1['tokens_used']="N/A"
        return dict1
    
if __name__ == "__main__":
    validator_agent=ValidatorAgent("nigger")
    print(validator_agent.finalized_values())  