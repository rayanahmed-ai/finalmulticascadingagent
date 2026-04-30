
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

def test_nsfw():
    model_name = "qiuhuachuan/NSFW-detector"
    print(f"Testing model: {model_name}")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        model.eval()
        
        text = "hi"
        inputs = tokenizer(text, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)
            predictions = torch.argmax(outputs.logits, dim=-1)
            print(f"Prediction for '{text}': {predictions.item()}")
            
        text2 = "pornography"
        inputs2 = tokenizer(text2, return_tensors="pt")
        with torch.no_grad():
            outputs2 = model(**inputs2)
            predictions2 = torch.argmax(outputs2.logits, dim=-1)
            print(f"Prediction for '{text2}': {predictions2.item()}")
            
        print("Model loaded and ran successfully with AutoModel.")
    except Exception as e:
        print(f"Failed with AutoModel: {e}")

if __name__ == "__main__":
    test_nsfw()
