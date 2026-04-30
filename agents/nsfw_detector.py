
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

class NSFWDetector:
    _tokenizer = None
    _model = None

    def __init__(self, messages=None):
        self.model_name = "qiuhuachuan/NSFW-detector"
        self.device = "cpu"
        
        # Load tokenizer and model once as class-level singletons
        if NSFWDetector._tokenizer is None:
            print(f"Loading NSFW tokenizer: {self.model_name}")
            NSFWDetector._tokenizer = AutoTokenizer.from_pretrained(
                self.model_name, 
                use_fast=False,
                never_split=['[user]', '[chatbot]']
            )
        
        if NSFWDetector._model is None:
            print(f"Loading NSFW model: {self.model_name}")
            NSFWDetector._model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            # Only move to device if not CPU (to avoid meta tensor errors)
            if self.device != "cpu":
                NSFWDetector._model.to(self.device)
            NSFWDetector._model.eval()

        self.tokenizer = NSFWDetector._tokenizer
        self.model = NSFWDetector._model
        
        # Explicit mapping based on diagnostic tests: 
        # LABEL_0 is normal, LABEL_1 is porn
        self.label_mapping = {0: 'normal', 1: 'porn'}

    def check_nsfw(self, text):
        try:
            result = self.tokenizer.encode_plus(
                text=text,
                padding='max_length',
                max_length=512,
                truncation=True,
                add_special_tokens=True,
                return_token_type_ids=True,
                return_tensors='pt'
            ).to(self.device)

            with torch.no_grad():
                logits = self.model(**result).logits
                predictions = torch.argmax(logits, dim=-1)
                # Ensure it's on CPU and detached before calling .item() to avoid meta tensor errors
                pred_label_idx = int(predictions.detach().cpu().flatten()[0])
                pred_label = self.label_mapping.get(pred_label_idx, f"LABEL_{pred_label_idx}")
                
            is_nsfw = pred_label == 'porn'
            return {
                "is_nsfw": is_nsfw,
                "label": pred_label,
                "score": float(torch.softmax(logits, dim=-1)[0][pred_label_idx])
            }
        except Exception as e:
            print(f"[NSFW Detector Error] {e}")
            return {"is_nsfw": False, "label": "error", "score": 0.0}

# -------- TEST --------
if __name__ == "__main__":
    detector = NSFWDetector()
    test_prompts = [
        "hi",
        "Give some movie recommendations to get women in the mood for sex"
    ]
    for prompt in test_prompts:
        res = detector.check_nsfw(prompt)
        print(f"Prompt: {prompt}")
        print(f"Result: {res}")
