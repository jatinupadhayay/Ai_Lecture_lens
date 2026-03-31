import os
import sys
import json
from transformers import pipeline

_quiz_pipeline = None


def get_quiz_pipeline():
    global _quiz_pipeline
    if _quiz_pipeline is None:
        # Try local model first, fall back to HuggingFace model
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        local_model = os.path.join(base_dir, "models", "quiz_model")

        if os.path.exists(local_model):
            print(f"[quiz] Loading local model: {local_model}", file=sys.stderr)
            _quiz_pipeline = pipeline("text2text-generation", model=local_model, tokenizer=local_model)
        else:
            print("[quiz] Loading mrm8488/t5-base-finetuned-question-generation-ap from HuggingFace...", file=sys.stderr)
            _quiz_pipeline = pipeline(
                "text2text-generation",
                model="mrm8488/t5-base-finetuned-question-generation-ap",
                device=-1,
            )
    return _quiz_pipeline


def generate_quiz(text, num_questions=5):
    """Generate quiz questions from text using T5."""
    if not text or len(text.split()) < 20:
        return ["Not enough content to generate questions."]

    try:
        generator = get_quiz_pipeline()

        # Split text into chunks and generate questions from each
        sentences = text.split(". ")
        questions = []

        for i in range(0, len(sentences), max(1, len(sentences) // num_questions)):
            if len(questions) >= num_questions:
                break

            chunk = ". ".join(sentences[i:i+3])
            if len(chunk.split()) < 10:
                continue

            prompt = f"generate question: {chunk}"
            try:
                result = generator(prompt, max_length=128, num_return_sequences=1)
                q = result[0]["generated_text"].strip()
                if q and q not in questions:
                    questions.append(q)
            except Exception:
                continue

        if not questions:
            # Fallback: generate from full text
            prompt = f"generate question: {text[:1000]}"
            result = generator(prompt, max_length=128, num_return_sequences=1)
            questions.append(result[0]["generated_text"].strip())

        return questions[:num_questions]

    except Exception as e:
        print(f"[quiz] Generation failed: {e}", file=sys.stderr)
        return [f"Error generating quiz: {str(e)}"]


# -------------------- CLI --------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)

    input_text = sys.argv[1]

    if os.path.exists(input_text):
        with open(input_text, "r", encoding="utf-8") as f:
            input_text = f.read()

    questions = generate_quiz(input_text)
    # Output one question per line (for backward compat with aiService.js parsing)
    for q in questions:
        print(q)
