from transformers import pipeline
import time

class TransformerClassifierAgent:
    _pipeline = None

    def __init__(self, message, model_name="distilbert-base-uncased-finetuned-sst-2-english"):
        # Load Hugging Face pipeline as a singleton
        if TransformerClassifierAgent._pipeline is None:
            print(f"Loading Transformer pipeline: {model_name}")
            TransformerClassifierAgent._pipeline = pipeline("text-classification", model=model_name, device=-1)
        
        self.classifier = TransformerClassifierAgent._pipeline

    def process(self, text):
        start_time = time.time()
        result = self.classifier(text)[0]

        # Example decision logic
        blocked = result["label"].lower() in ["unsafe", "toxic", "malicious"]
        reason = f"Transformer classified as {result['label']} (score={result['score']:.2f})"

        return {
            "blocked": blocked,
            "reason": reason,
            "message": text[:100] + "..." if len(text) > 100 else text,
            "timestamp": f"{time.time() - start_time:.3f}s",
            "tokens_used": "N/A"  # you can track tokens if using a tokenizer
        }