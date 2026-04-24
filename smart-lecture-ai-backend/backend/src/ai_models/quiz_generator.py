import os
import sys
import json
import random
import re
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

_model = None
_tokenizer = None

FLAN_T5_MODEL = "google/flan-t5-base"


def get_model_and_tokenizer():
    global _model, _tokenizer
    if _model is None:
        # Try local fine-tuned model first, fall back to HuggingFace Flan-T5
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        local_model = os.path.join(base_dir, "models", "quiz_model")

        model_name = local_model if os.path.exists(local_model) else FLAN_T5_MODEL
        print(f"[quiz] Loading model: {model_name}", file=sys.stderr)

        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        _model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        _model.eval()

    return _model, _tokenizer


def _generate(prompt, max_length=256):
    """Run text generation through Flan-T5."""
    model, tokenizer = get_model_and_tokenizer()
    inputs = tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
    outputs = model.generate(
        **inputs,
        max_length=max_length,
        num_beams=4,
        early_stopping=True,
        no_repeat_ngram_size=3,
    )
    return tokenizer.decode(outputs[0], skip_special_tokens=True).strip()


def _extract_key_phrases(text):
    """Extract meaningful noun phrases / terms from text for distractor generation."""
    # Extract multi-word phrases around key patterns
    phrases = set()

    # Find "X is/are Y" patterns
    for match in re.finditer(r'(\b[A-Z][\w\s]{3,30}?)\b(?:is|are|means|refers to)\b(.{5,40}?)(?:\.|,|;)', text):
        subject = match.group(1).strip()
        definition = match.group(2).strip()
        if len(subject.split()) <= 5:
            phrases.add(subject)
        if len(definition.split()) <= 6:
            phrases.add(definition)

    # Find capitalized multi-word terms (e.g., "Neural Networks", "Machine Learning")
    for match in re.finditer(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b', text):
        term = match.group(1)
        if len(term) > 4:
            phrases.add(term)

    # Find terms after "such as", "including", "like"
    for match in re.finditer(r'(?:such as|including|like)\s+(.{5,60}?)(?:\.|;|$)', text):
        items = re.split(r',\s*(?:and\s+)?|\s+and\s+', match.group(1))
        for item in items:
            item = item.strip().rstrip('.')
            if 2 < len(item.split()) <= 5:
                phrases.add(item)

    return list(phrases)


def _generate_question_from_chunk(chunk):
    """Generate a question from a text chunk using Flan-T5 instruction prompting."""
    prompt = (
        f"Generate a multiple choice question with 4 options from the following text. "
        f"Format: Question followed by A), B), C), D) options, then the correct answer letter.\n\n"
        f"Text: {chunk}\n\n"
        f"Multiple choice question:"
    )
    return _generate(prompt, max_length=256)


def _generate_answer_from_chunk(chunk):
    """Generate a question + answer pair from a chunk."""
    q_prompt = f"Generate a question about the following text:\n\n{chunk}\n\nQuestion:"
    question = _generate(q_prompt, max_length=128)

    if not question:
        return None, None

    a_prompt = f"Answer the following question based on the text.\n\nText: {chunk}\n\nQuestion: {question}\n\nAnswer:"
    answer = _generate(a_prompt, max_length=64)

    return question, answer


def _generate_distractors(chunk, question, correct_answer, full_text="", num_distractors=3):
    """Generate plausible wrong options (distractors) for MCQ."""
    # Strategy 1: Ask Flan-T5 for wrong answers to the same question
    prompt = (
        f"Question: {question}\n"
        f"Correct answer: {correct_answer}\n\n"
        f"List {num_distractors} plausible but wrong answers to this question. "
        f"Each answer should be similar in length and style to the correct answer.\n\n"
        f"Wrong answers:"
    )

    raw = _generate(prompt, max_length=128)
    distractors = []

    # Parse: handle comma-separated, newline-separated, or numbered lists
    candidates = re.split(r'[\n,;]|\d+[.)]\s*', raw)
    for item in candidates:
        item = re.sub(r'^[\-\*\s]+', '', item).strip().rstrip('.')
        if (item
                and item.lower() != correct_answer.lower()
                and len(item) > 3
                and item.lower() not in ("none", "all", "the", "a", "an")):
            distractors.append(item)

    # Strategy 2: Extract meaningful phrases from full text as alternatives
    if len(distractors) < num_distractors:
        source_text = full_text if full_text else chunk
        key_phrases = _extract_key_phrases(source_text)
        random.shuffle(key_phrases)
        for phrase in key_phrases:
            if (phrase.lower() != correct_answer.lower()
                    and phrase not in distractors
                    and len(phrase) > 3):
                distractors.append(phrase)
            if len(distractors) >= num_distractors:
                break

    # Strategy 3: Generate related-but-wrong answers via targeted prompts
    if len(distractors) < num_distractors:
        alt_prompt = (
            f"Based on this text, name concepts or terms that are related to "
            f"but different from '{correct_answer}':\n\n{chunk[:300]}\n\nRelated terms:"
        )
        alt_raw = _generate(alt_prompt, max_length=64)
        for item in re.split(r'[\n,;]', alt_raw):
            item = item.strip().rstrip('.')
            if (item
                    and item.lower() != correct_answer.lower()
                    and item not in distractors
                    and len(item) > 3):
                distractors.append(item)
            if len(distractors) >= num_distractors:
                break

    # Final fallback with domain-relevant generic options
    fallbacks = ["None of the above", "All of the above", "Cannot be determined from the text"]
    while len(distractors) < num_distractors:
        fb = fallbacks.pop(0) if fallbacks else f"Option {len(distractors) + 1}"
        if fb not in distractors:
            distractors.append(fb)

    return distractors[:num_distractors]


def _parse_mcq_output(raw_text):
    """Try to parse a structured MCQ from Flan-T5 output."""
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    if not lines:
        return None

    question = None
    options = []
    correct_idx = 0

    option_pattern = re.compile(r'^([A-Da-d])[.)]\s*(.+)')
    answer_pattern = re.compile(r'(?:answer|correct)[:\s]*([A-Da-d])', re.IGNORECASE)

    for line in lines:
        opt_match = option_pattern.match(line)
        ans_match = answer_pattern.search(line)

        if opt_match:
            options.append(opt_match.group(2).strip())
        elif ans_match:
            letter = ans_match.group(1).upper()
            correct_idx = {"A": 0, "B": 1, "C": 2, "D": 3}.get(letter, 0)
        elif not question:
            question = re.sub(r'^(?:Q?\d+[.)]\s*)', '', line).strip()

    if question and len(options) == 4:
        return {
            "question": question,
            "options": options,
            "correctAnswer": correct_idx,
        }
    return None


def generate_quiz(text, num_questions=5):
    """Generate MCQ quiz questions from text using Flan-T5-base."""
    if not text or len(text.split()) < 20:
        return []

    try:
        # Warm up model
        get_model_and_tokenizer()

        sentences = text.split(". ")
        step = max(1, len(sentences) // num_questions)
        questions = []
        seen_questions = set()

        for i in range(0, len(sentences), step):
            if len(questions) >= num_questions:
                break

            chunk = ". ".join(sentences[i:i + 4])
            if len(chunk.split()) < 10:
                continue

            try:
                # Strategy 1: Try direct MCQ generation
                raw_mcq = _generate_question_from_chunk(chunk)
                parsed = _parse_mcq_output(raw_mcq)

                if parsed and parsed["question"] not in seen_questions:
                    seen_questions.add(parsed["question"])
                    questions.append(parsed)
                    continue

                # Strategy 2: Generate Q&A pair, then build MCQ with distractors
                question, answer = _generate_answer_from_chunk(chunk)
                if question and answer and question not in seen_questions:
                    distractors = _generate_distractors(chunk, question, answer, full_text=text)
                    options = [answer] + distractors
                    # Shuffle options so correct answer isn't always first
                    combined = list(zip(options, [True] + [False] * len(distractors)))
                    random.shuffle(combined)
                    shuffled_options = [o for o, _ in combined]
                    correct_idx = next(i for i, (_, is_correct) in enumerate(combined) if is_correct)

                    seen_questions.add(question)
                    questions.append({
                        "question": question,
                        "options": shuffled_options,
                        "correctAnswer": correct_idx,
                    })
            except Exception as e:
                print(f"[quiz] Chunk generation failed: {e}", file=sys.stderr)
                continue

        # Fallback: generate from full text if no questions produced
        if not questions:
            chunk = text[:1500]
            question, answer = _generate_answer_from_chunk(chunk)
            if question and answer:
                distractors = _generate_distractors(chunk, question, answer, full_text=text)
                options = [answer] + distractors
                random.shuffle(options)
                correct_idx = options.index(answer)
                questions.append({
                    "question": question,
                    "options": options,
                    "correctAnswer": correct_idx,
                })

        return questions[:num_questions]

    except Exception as e:
        print(f"[quiz] Generation failed: {e}", file=sys.stderr)
        return []


def format_mcq_lines(questions):
    """Format structured MCQ list into text lines (backward compat with aiService.js)."""
    lines = []
    letters = ["A", "B", "C", "D"]
    for i, q in enumerate(questions):
        if isinstance(q, dict):
            lines.append(f"Q{i+1}. {q['question']}")
            for j, opt in enumerate(q.get("options", [])):
                lines.append(f"{letters[j]}) {opt}")
            correct = q.get("correctAnswer", 0)
            lines.append(f"Answer: {letters[correct]}")
            lines.append("---")
        else:
            lines.append(str(q))
    return lines


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

    # Output structured JSON for programmatic use
    if "--json" in sys.argv:
        print(json.dumps(questions, indent=2))
    else:
        # Text format for backward compat with aiService.js parsing
        for line in format_mcq_lines(questions):
            print(line)
