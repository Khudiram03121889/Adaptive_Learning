import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Redirect stdout to a file so we can view it
sys.stdout = open("test_out.txt", "w", encoding="utf-8")
sys.stderr = sys.stdout

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")
print("Key:", NVIDIA_API_KEY)

client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = NVIDIA_API_KEY,
  timeout = 30.0
)

models_to_try = [
    "z-ai/glm-5.1",
    "meta/llama-3.1-70b-instruct",
    "nvidia/llama-3.1-nemotron-70b-instruct"
]

for model in models_to_try:
    try:
        print(f"Testing {model}...")
        sys.stdout.flush()
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            temperature=0.7,
            max_tokens=50,
            stream=False
        )
        print("Success for", model)
        print(completion.choices[0].message.content)
    except Exception as e:
        print(f"Failed {model}: {e}")
        sys.stdout.flush()

print("Finished all tests.")
sys.stdout.close()
