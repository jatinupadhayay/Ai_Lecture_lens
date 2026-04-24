import os
import sys
import json
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

_model = None
_tokenizer = None


def _load_model():
    global _model, _tokenizer
    if _model is not None:
        return

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    local_model = os.path.join(base_dir, "models", "quiz_model")

    model_name = local_model if os.path.exists(local_model) else "google/flan-t5-base"
    print(f"[quiz] Loading model: {model_name}", file=sys.stderr)

    _tokenizer = AutoTokenizer.from_pretrained(model_name)
    _model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    _model.eval()
    print("[quiz] Model loaded.", file=sys.stderr)


def _generate_one(prompt: str, max_new_tokens: int = 200) -> str:
    inputs = _tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = _model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            num_beams=2,
            early_stopping=True,
        )
    return _tokenizer.decode(outputs[0], skip_special_tokens=True).strip()


def generate_quiz(text: str, num_questions: int = 5):
    """Generate MCQ questions from text using Flan-T5-base."""
    if not text or len(text.split()) < 20:
        return ["Not enough content to generate questions."]

    try:
        _load_model()

        sentences = [s.strip() for s in text.split(".") if s.strip()]
        step = max(1, len(sentences) // num_questions)
        questions = []

        for i in range(0, len(sentences), step):
            if len(questions) >= num_questions:
                break
            chunk = ". ".join(sentences[i : i + 3])
            if len(chunk.split()) < 10:
                continue

            prompt = (
                f"Generate a multiple choice question with 4 options (A, B, C, D) "
                f"and mark the correct answer based on this text:\n{chunk}"
            )
            try:
                q = _generate_one(prompt)
                if q and q not in questions:
                    questions.append(q)
            except Exception:
                continue

        if not questions:
            prompt = (
                f"Generate a multiple choice question with 4 options (A, B, C, D) "
                f"and mark the correct answer based on this text:\n{text[:800]}"
            )
            questions.append(_generate_one(prompt))

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
    for q in questions:
        print(q)
