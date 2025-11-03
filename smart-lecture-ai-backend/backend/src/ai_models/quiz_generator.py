# videos/utils/quiz_generator.py
from transformers import pipeline
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "quiz_model")

def generate_quiz(text, summary):
    """
    Generates quiz questions from transcript or summary text.
    """
    try:
        print("🧠 Generating quiz using model at:", MODEL_PATH)

        quiz_generator = pipeline(
            "text2text-generation",
            model=MODEL_PATH,
            tokenizer=MODEL_PATH,
        )

        prompt = f"Generate 5 short quiz questions from the following lecture summary:\n\n{summary}"
        result = quiz_generator(prompt, max_length=512, num_return_sequences=1)
        quiz_text = result[0]["generated_text"]

        # Convert simple text output into list format
        quiz_list = [q.strip() for q in quiz_text.split("\n") if q.strip()]
        return quiz_list[:5]
    except Exception as e:
        print("❌ Quiz generation failed:", e)
        return ["Error generating quiz"]
