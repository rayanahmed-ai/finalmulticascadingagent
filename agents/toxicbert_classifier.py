import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

class ToxicBertClassifier:
    _tokenizer = None
    _model = None

    def __init__(self, messages=None):
        model_name = "JungleLee/bert-toxic-comment-classification"
        self.device = "cpu"
        
        # Load singletons
        if ToxicBertClassifier._tokenizer is None:
            print(f"Loading ToxicBert tokenizer: {model_name}")
            ToxicBertClassifier._tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        if ToxicBertClassifier._model is None:
            print(f"Loading ToxicBert model: {model_name}")
            ToxicBertClassifier._model = AutoModelForSequenceClassification.from_pretrained(model_name)
            if self.device != "cpu":
                ToxicBertClassifier._model.to(self.device)
            ToxicBertClassifier._model.eval()

        self.tokenizer = ToxicBertClassifier._tokenizer
        self.model = ToxicBertClassifier._model

    def check_toxicity(self, text, threshold=0.5):
        try:
            inputs = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True).to(self.device)

            with torch.no_grad():
                outputs = self.model(**inputs)

            logits = outputs.logits
            probabilities = torch.sigmoid(logits)[0]  # multi-label classification

            labels = self.model.config.id2label
            results = {labels[i]: float(probabilities[i]) for i in range(len(probabilities))}

            # Check if "toxic" score exceeds threshold
            print(results)
            is_toxic = results.get("toxic", 0.0) > threshold
            return is_toxic
        except Exception as e:
            print(f"[ToxicBert Error] {e}")
            return False


# -------- TEST --------
if __name__ == "__main__":
    classifier = ToxicBertClassifier()
    text = "hi"
    toxic= classifier.check_toxicity(text)

    print("Toxic:", toxic)
    print("Final Decision:", "toxic" if toxic else "not toxic")