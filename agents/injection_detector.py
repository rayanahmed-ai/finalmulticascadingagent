class InjectionDetectorAgent:
    def __init__(self,messages):
        self.guardrail_Safety_content = self.get_guardrailsafety(messages)
        self.guardrail_ethical_content = self.get_guardrailsethical(messages)
        self.messages=messages
    
    def get_guardrailsafety(self, messages):
        text_ns = "unsafe"
        # Cache the result to avoid redundant calls
        if not hasattr(self, '_guardrail_a_result'):
            self._guardrail_a_result = self.get_guardrailA(messages)
            
        if text_ns in self._guardrail_a_result.lower():
            return True
        else:
            return False

    def get_guardrailsethical(self,messages):
        return self.get_guardrailB(messages)

    def get_guardrailA(self,messages):
        # from transformers import AutoProcessor, AutoModelForImageTextToText

        # processor = AutoProcessor.from_pretrained("meta-llama/Llama-Guard-4-12B")
        # model = AutoModelForImageTextToText.from_pretrained("meta-llama/Llama-Guard-4-12B")
        # messages = [
        #     {
        #         "role": "user",
        #         "content": [
        #             {"type": "text", "text": f"{messages}"}
        #         ]
        #     },
        # ]
        # inputs = processor.apply_chat_template(
        #     messages,
        #     add_generation_prompt=True,
        #     tokenize=True,
        #     return_dict=True,
        #     return_tensors="pt",
        # ).to(model.device)

        # outputs = model.generate(**inputs, max_new_tokens=40)
        # response=processor.decode(outputs[0][inputs["input_ids"].shape[-1]:])
        # return response
        try:
            from groq import Groq
            import os
            from dotenv import load_dotenv
            load_dotenv()

            # Make sure GROQ_API_KEY is set in environment
            client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
            user_input = messages

            result = self.check_prompt(user_input,client)

            print("Llama Guard Response:")
            print(result)
            return result
        except Exception as e:
            print(f"[Injection Detector Error] {e}")
            return "safe" # Default to safe on API failure

    def check_prompt(self, prompt,client):

        classification_prompt = f"""
You are a safety classifier.

Determine whether the following user input is SAFE or UNSAFE.

Mark UNSAFE if it contains:
- Violence
- Murder
- Criminal activity
- Illegal instructions
- Harm to a person
- Weapons
- Self-harm
- Sexual content

Respond with ONLY one word:
SAFE
or
UNSAFE

User Input:
{prompt}
"""

        response = client.chat.completions.create(
            model="meta-llama/llama-guard-4-12b",
            messages=[
                {
                    "role": "user",
                    "content": classification_prompt
                }
            ],
            temperature=0
        )

        result = response.choices[0].message.content.strip()

        return result


    def get_guardrailB(self,messages):
        import requests
        invoke_url = "https://ai.api.nvidia.com/v1/security/nvidia/nemoguard-jailbreak-detect"

        headers = {
            "Authorization": "Bearer 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",
            "Accept": "application/json"
            }
        print(messages)
        payload = {
            "input": f"{messages}"
            }

        response = requests.post(invoke_url, headers=headers, json=payload)
        print(response.json())

        return list(response.json().values())[0]

    def finalized(self,messages):
        dict1=dict()
        dict1["blocked"]=self.get_guardrailsafety(messages) or self.get_guardrailsethical(messages)
        dict1["message"]=self.messages
        dict1['timestamp']="instant"
        dict1['tokens_used']="0"
        return dict1


        
        o