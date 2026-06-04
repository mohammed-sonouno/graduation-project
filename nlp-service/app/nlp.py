from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional, Tuple

import torch
import torch.nn.functional as F
from langdetect import detect as lang_detect
from transformers import AutoModelForSequenceClassification, AutoTokenizer

SentimentClass = Literal["positive", "neutral", "negative"]
CODE_VERSION = "GP-NLP-AR-MIXED-V2"

# ---------------------------------------------------------------------------
# Static linguistics data
# ---------------------------------------------------------------------------

STOP_WORDS: set = {
    # MSA function words
    "في", "من", "على", "إلى", "عن", "مع", "هذا", "هذه", "هو", "هي",
    "هم", "نحن", "انا", "أنا", "انت", "أنت", "التي", "الذي", "التي",
    "كان", "كانت", "يكون", "تكون", "كل", "بعض", "عند", "عندما",
    "لما", "لان", "لأن", "لأنه", "لكن", "او", "أو", "اي", "أي",
    "ما", "مما", "ذلك", "تلك", "فقط", "جدا", "جداً", "قد", "قبل",
    "بعد", "حتى", "ثم", "اذا", "إذا", "لو", "مثل", "غير",
    "حول", "خلال", "بين", "تحت", "فوق", "امام", "أمام", "وراء",
    "الان", "الآن", "هنا", "هناك", "اين", "أين", "متى", "كيف",
    "لماذا", "لذلك", "وهذا", "وهذه", "وهو", "وهي",
    # Levantine / Palestinian dialect
    "كتير", "هيك", "هاي", "هاد", "هاده", "وكلشي", "كلشي", "شي",
    "بس", "لهيك", "مثل هيك", "هيدا", "هيدي", "هيدن",
    "لأنو", "لانو", "منشان", "عشان", "علشان", "اشي", "إشي",
    "فيه", "فيها", "فيهم", "منه", "منها", "منهم",
    "انو", "انها", "اللي", "يلي",
    # Filler / intensifiers that carry no topic signal
    "كثير", "اكثر", "أكثر", "اقل", "أقل", "تقريبا", "تقريباً",
    "صراحه", "صراحة", "بصراحه", "بصراحة", "يعني", "خلص",
    "طبعا", "طبعاً", "اكيد", "أكيد", "مو", "مش", "ما",
    "لا", "نعم", "ايه", "أيه", "اه", "آه", "اوك", "اوكي",
    "زي", "زي ما", "كمان", "برضو", "برضه",
    # English function words / conjunctions / filler
    "the", "a", "an", "is", "was", "were", "be", "been", "are",
    "and", "or", "but", "so", "yet", "nor", "for",
    "in", "on", "at", "to", "of", "by", "with", "from", "as",
    "it", "its", "this", "that", "these", "those",
    "i", "we", "you", "he", "she", "they", "me", "us", "him", "her", "them",
    "my", "our", "your", "his", "their",
    "not", "no", "very", "just", "quite", "really", "also", "too",
    "have", "has", "had", "do", "does", "did", "will", "would", "can", "could",
    "there", "here", "if", "when", "how", "what", "which", "who",
    "however", "although", "though", "still", "only", "more", "most",
}

NEGATION_WORDS = {"مش", "ما", "مو", "لا", "غير", "بدون", "ليس", "لم", "لن", "لا يوجد"}

POSITIVE_WORDS = {
    "ممتاز", "رائع", "حلو", "جيد", "منيح", "جميل", "كويس", "مفيد",
    "رائعة", "حلوه", "جيده", "مميز", "مميزة", "عظيم", "عظيمة",
    "مبدع", "مبدعة", "بديع", "بديعة", "فخم", "فخمة", "مدهش",
    "مدهشة", "انيق", "انيقة", "احترافي", "احترافية",
    "ممتازة", "استمتعنا", "استمتعت", "نجح", "نجحت", "ناجح", "ناجحة",
    "مرتب", "منظم", "منظمه", "تمام",
    # English
    "good", "great", "excellent", "amazing", "awesome", "wonderful",
    "fantastic", "perfect", "outstanding", "brilliant", "superb",
    "nice", "enjoyable", "impressive", "helpful", "useful",
    "clear", "informative", "well", "best",
}

NEGATIVE_WORDS = {
    "سيء", "سيئ", "وحش", "زفت", "مزعج", "مزعجة", "فوضى",
    "فوضوي", "فوضوية", "مشكلة", "مشاكل", "سلبي", "سلبية",
    "ضعيف", "ضعيفه", "ضعيفة", "رديء", "رديئة", "بطيء", "بطيئة",
    "مؤلم", "مؤلمة", "صعب", "صعبة", "متعب", "متعبة",
    "ممل", "مملة", "غير منظم", "غير منظمة",
    # English
    "bad", "poor", "weak", "terrible", "awful", "horrible", "broken",
    "noisy", "loud", "quiet", "inaudible", "boring", "disorganized",
}

# Aspect keyword lists  (Arabic + English equivalents)
ASPECTS: Dict[str, List[str]] = {
    "الصوت": [
        # Arabic
        "صوت", "ميكروفون", "سماعات", "سماعة", "مسموع", "الصوت",
        # English
        "sound", "audio", "mic", "microphone", "speaker", "speakers",
        "volume", "acoustics", "hearing", "audible",
    ],
    "الأكل": [
        # Arabic
        "اكل", "أكل", "طعام", "وجبة", "وجبات", "مشروبات", "مشروب", "قهوة", "شاي", "بوفيه",
        # English
        "food", "meal", "meals", "drink", "drinks", "coffee", "tea", "buffet", "catering", "snacks",
    ],
    "المكان": [
        # Arabic
        "مكان", "قاعة", "مساحة", "ضيق", "كراسي", "كرسي", "مقاعد", "مقعد", "قعدات", "طاولات", "طاولة",
        # English
        "place", "venue", "hall", "room", "space", "chair", "chairs", "seat", "seats",
        "table", "tables", "location", "crowded", "capacity",
    ],
    "التنظيم": [
        # Arabic
        "تنظيم", "ترتيب", "فوضى", "تأخر", "تأخير", "منظم", "مرتب", "وقت", "جدول", "برنامج",
        # English
        "organization", "organisation", "management", "schedule", "timing", "time",
        "delay", "delayed", "punctual", "organized", "arranged", "planning",
    ],
    "المحتوى": [
        # Arabic
        "محتوى", "موضوع", "معلومات", "مفيد", "مفيدة", "قيم", "قيمة", "مميز", "تعليمي",
        # English
        "content", "topic", "information", "useful", "valuable", "educational",
        "material", "quality", "presentation", "slides", "workshop",
    ],
    "المتحدث": [
        # Arabic
        "متحدث", "مقدم", "دكتور", "محاضر", "شرح", "اسلوب", "طريقة",
        # English
        "speaker", "presenter", "doctor", "professor", "lecturer",
        "explanation", "style", "delivery", "instructor",
    ],
}

# Issue patterns and canonical synonym mapping
ISSUE_SYNONYMS: Dict[str, str] = {
    # Arabic — seating
    "كراسي": "الكراسي", "كرسي": "الكراسي", "مقاعد": "الكراسي", "مقعد": "الكراسي", "قعدات": "الكراسي",
    # Arabic — sound
    "صوت": "الصوت", "ميكروفون": "الصوت", "سماعات": "الصوت", "سماعة": "الصوت",
    # Arabic — food
    "اكل": "الأكل", "أكل": "الأكل", "طعام": "الأكل", "وجبة": "الأكل",
    # Arabic — venue
    "مكان": "المكان", "قاعة": "المكان", "مساحة": "المكان",
    # Arabic — organization
    "تنظيم": "التنظيم", "ترتيب": "التنظيم",
    # Arabic — time
    "وقت": "الوقت", "تأخر": "الوقت", "تأخير": "الوقت",
    # English equivalents (for mixed-language reviews)
    "sound": "الصوت", "audio": "الصوت", "mic": "الصوت", "microphone": "الصوت",
    "chair": "الكراسي", "chairs": "الكراسي", "seat": "الكراسي", "seats": "الكراسي",
    "food": "الأكل", "meal": "الأكل",
    "place": "المكان", "venue": "المكان", "hall": "المكان", "room": "المكان",
    "organization": "التنظيم", "organisation": "التنظيم", "management": "التنظيم",
    "content": "المحتوى", "topic": "المحتوى",
    "time": "الوقت", "timing": "الوقت", "delay": "الوقت",
}

# Trigger words indicating shortage/problem — both Arabic and English
ISSUE_TRIGGER_WORDS = {
    "مشكلة", "مشاكل", "قليل", "قليله", "ناقص", "ناقصه", "ضيق",
    "نقص", "قله", "شحه",          # Arabic shortage nouns
    "bad", "poor", "weak", "terrible", "awful", "horrible", "broken", "missing",
}
ISSUE_ABSENCE_PATTERNS = [
    r"ما\s+(?:في|كان|كانت|فيه|فيها)\s+(\S+)",
    r"مافي\s+(\S+)",
    r"ما\s+فيه\s+(\S+)",
]


# ---------------------------------------------------------------------------
# Text normalization helpers
# ---------------------------------------------------------------------------

def normalize_arabic(text: str) -> str:
    """Normalize hamza, ta marbuta, and collapse repeated chars."""
    if not text:
        return text
    # Collapse 3+ repeated Arabic chars to 1 (رااائع → رائع)
    text = re.sub(r"([؀-ۿ])\1{2,}", r"\1", text)
    # Collapse 3+ repeated Latin chars to 2
    text = re.sub(r"([A-Za-z])\1{2,}", r"\1\1", text)
    # Normalize hamza forms → ا
    text = re.sub(r"[أإآ]", "ا", text)
    # Normalize ta marbuta → ه
    text = text.replace("ة", "ه")
    # Remove diacritics (tashkeel)
    text = re.sub(r"[ً-ٟ]", "", text)
    return text


def strip_conjunction_prefix(token: str) -> str:
    """Strip leading conjunction letters و، ف، ب، ل from a token."""
    return re.sub(r"^[وفبل]+", "", token) if len(token) > 2 else token


def strip_definite_article(token: str) -> str:
    """Strip leading ال (definite article) from a token."""
    if token.startswith("ال") and len(token) > 3:
        return token[2:]
    return token


def tokenize_arabic(text: str) -> List[str]:
    """Extract Arabic and English word tokens; strip conjunction prefixes from Arabic."""
    arabic_tokens = [strip_conjunction_prefix(t) for t in re.findall(r"[؀-ۿ]+", text) if t]
    english_tokens = [t.lower() for t in re.findall(r"[A-Za-z]+", text) if len(t) > 1]
    return arabic_tokens + english_tokens


def is_gibberish(text: str) -> bool:
    """True if text has too few meaningful characters (Arabic or English words)."""
    arabic_chars = re.findall(r"[؀-ۿ]", text)
    english_words = re.findall(r"[A-Za-z]{2,}", text)
    return len(arabic_chars) < 4 and len(english_words) < 2


def compute_confidence(
    tokens: List[str],
    raw_text: str,
    model_max_prob: float,
) -> float:
    """Compute a 0–1 confidence score, penalizing low-quality text."""
    score = model_max_prob

    # Penalize very short text
    if len(tokens) < 3:
        score *= 0.6
    elif len(tokens) < 5:
        score *= 0.8

    # Penalize high stop-word ratio
    non_stop = [t for t in tokens if t not in STOP_WORDS and len(t) > 1]
    if tokens:
        stop_ratio = 1 - len(non_stop) / max(len(tokens), 1)
        if stop_ratio > 0.7:
            score *= 0.7
        elif stop_ratio > 0.5:
            score *= 0.85

    # Penalize gibberish
    if is_gibberish(raw_text):
        score *= 0.4

    return round(min(max(score, 0.0), 1.0), 3)


def sentiment_from_stars(stars: int) -> SentimentClass:
    if stars >= 4:
        return "positive"
    if stars == 3:
        return "neutral"
    return "negative"


# ---------------------------------------------------------------------------
# Negation handling
# ---------------------------------------------------------------------------

def apply_negation(tokens: List[str], probs: Dict[SentimentClass, float]) -> Dict[SentimentClass, float]:
    """
    Detect negation words and flip positive↔negative probabilities
    if a negation word precedes a positive/negative content word.
    """
    has_negation = False
    for i, tok in enumerate(tokens):
        if tok in NEGATION_WORDS:
            # Check if any of the next 3 tokens is a meaningful sentiment word
            window = tokens[i + 1: i + 4]
            if any(w in POSITIVE_WORDS or w in NEGATIVE_WORDS for w in window):
                has_negation = True
                break

    if has_negation:
        return {
            "positive": probs["negative"],
            "neutral": probs["neutral"],
            "negative": probs["positive"],
        }
    return probs


# ---------------------------------------------------------------------------
# Keyword extraction
# ---------------------------------------------------------------------------

def get_negated_tokens(tokens: List[str]) -> set:
    """Return sentiment words that are directly preceded by a negation word."""
    negated: set = set()
    for i, tok in enumerate(tokens):
        if tok in NEGATION_WORDS:
            for w in tokens[i + 1: i + 4]:
                if w in POSITIVE_WORDS or w in NEGATIVE_WORDS:
                    negated.add(w)
                    break
    return negated


# Words that describe topics/issues — excluded from sentiment keyword list
_ISSUE_TOPIC_WORDS: set = (
    set(ISSUE_SYNONYMS.keys())
    | ISSUE_TRIGGER_WORDS
    | {"مشكله", "مشكلة", "مشاكل"}
)


def extract_keywords(
    tokens: List[str],
    max_kw: int = 5,
    excluded: Optional[set] = None,
) -> List[str]:
    """Return sentiment-bearing keywords; skip stop words, issue nouns, and negated tokens."""
    skip = STOP_WORDS | _ISSUE_TOPIC_WORDS | (excluded or set())
    seen: set = set()
    keywords: List[str] = []
    # Sentiment words first
    for tok in tokens:
        if tok not in skip and len(tok) > 2 and tok not in seen:
            if tok in POSITIVE_WORDS or tok in NEGATIVE_WORDS:
                seen.add(tok)
                keywords.append(tok)
    # Then any remaining clean token
    for tok in tokens:
        if tok not in skip and len(tok) > 2 and tok not in seen:
            seen.add(tok)
            keywords.append(tok)
    return keywords[:max_kw]


# ---------------------------------------------------------------------------
# Issue extraction
# ---------------------------------------------------------------------------

def _issue_canonical(tok: str) -> Optional[str]:
    """Return canonical issue label for a token (with or without definite article)."""
    bare = strip_definite_article(tok)
    for candidate in (tok, bare):
        c = ISSUE_SYNONYMS.get(candidate)
        if c:
            return c
    return None


def extract_issues(text: str, tokens: List[str]) -> List[str]:
    """
    Extract problem topics regardless of overall sentiment.
    Patterns:
      - مشكلة + topic
      - topic + قليل/ناقص/ضعيف (trigger or negative word within 3 tokens)
      - ما في/ما كان + topic
    """
    issues: set = set()

    # Pattern: absence / ما في + noun
    for pattern in ISSUE_ABSENCE_PATTERNS:
        for m in re.finditer(pattern, text):
            word = strip_conjunction_prefix(m.group(1))
            word = normalize_arabic(word)
            canonical = ISSUE_SYNONYMS.get(word)
            if canonical:
                issues.add(canonical)

    # Token-level patterns
    for i, tok in enumerate(tokens):
        # مشكلة + next topic token
        if tok in {"مشكله", "مشكلة", "مشاكل"}:
            if i + 1 < len(tokens):
                nxt = tokens[i + 1]
                if nxt not in STOP_WORDS and nxt not in NEGATION_WORDS:
                    canonical = _issue_canonical(nxt)
                    if canonical:
                        issues.add(canonical)

        # topic + trigger word — look at previous token (e.g. "كراسي قليله")
        if tok in ISSUE_TRIGGER_WORDS and i > 0:
            prev = tokens[i - 1]
            if prev not in STOP_WORDS:
                canonical = _issue_canonical(prev)
                if canonical:
                    issues.add(canonical)

        # trigger word + topic — look at next 2 tokens (e.g. "نقص بالكراسي", "bad sound")
        if tok in ISSUE_TRIGGER_WORDS:
            for nxt in tokens[i + 1: i + 3]:
                if nxt not in STOP_WORDS:
                    canonical = _issue_canonical(nxt)
                    if canonical:
                        issues.add(canonical)
                        break

        # NEW: issue noun + negative word within a 3-token window
        # handles "الصوت كان ضعيف", "التنظيم ضعيف جدا", etc.
        canonical = _issue_canonical(tok)
        if canonical:
            window = tokens[i + 1: i + 4]
            if any(w in NEGATIVE_WORDS or w in ISSUE_TRIGGER_WORDS for w in window):
                issues.add(canonical)

    return sorted(issues)


# ---------------------------------------------------------------------------
# Aspect-based sentiment
# ---------------------------------------------------------------------------

_CONTRAST_WORDS = {"but", "however", "although", "though", "yet", "بس", "لكن", "إلا", "رغم"}


def analyze_aspects(tokens: List[str], probs: Dict[SentimentClass, float]) -> Dict[str, str]:
    """
    For each aspect found in the token list, determine sentiment from
    surrounding context (window of 3 tokens each side).
    Matches tokens with or without the definite article ال.
    Contrast-aware: positive signals before a contrast word (but/بس) are
    discounted so they don't inflate the aspect sentiment.
    Returns title-cased sentiment strings.
    """
    results: Dict[str, str] = {}

    # Build a bare (article-stripped) form for each token for flexible matching
    bare_tokens = [strip_definite_article(tok) for tok in tokens]

    for aspect_name, aspect_keywords in ASPECTS.items():
        kw_set = set(aspect_keywords)
        found_indices = [
            i for i, (tok, bare) in enumerate(zip(tokens, bare_tokens))
            if tok in kw_set or bare in kw_set
        ]
        if not found_indices:
            continue

        # Gather context tokens around aspect mentions.
        # If a contrast word appears between the window start and the aspect,
        # only use tokens from the contrast word onward (pre-contrast positives
        # describe the general event, not this specific aspect).
        context_tokens: List[str] = []
        for idx in found_indices:
            window_start = max(0, idx - 3)
            window_end = min(len(tokens), idx + 4)
            pre_aspect = tokens[window_start:idx]
            contrast_pos_in_pre = next(
                (j for j, t in enumerate(pre_aspect) if t in _CONTRAST_WORDS), None
            )
            if contrast_pos_in_pre is not None:
                # Start from the contrast word, not from window_start
                effective_start = window_start + contrast_pos_in_pre
            else:
                effective_start = window_start
            context_tokens.extend(tokens[effective_start:window_end])

        # Count negative signals: explicit negative words, issue triggers, and absence markers
        neg_count = sum(1 for t in context_tokens if t in NEGATIVE_WORDS or t in ISSUE_TRIGGER_WORDS)
        pos_count = sum(1 for t in context_tokens if t in POSITIVE_WORDS)

        # Absence pattern around the aspect window: "ما في/ما كان" preceding the aspect
        for idx in found_indices:
            window = tokens[max(0, idx - 3): idx]
            if any(t in NEGATION_WORDS for t in window) and any(
                t in {"في", "كان", "كانت", "فيه", "فيها"} for t in window
            ):
                neg_count += 2  # strong negative signal for absence

        # Local negation in context (negation word + sentiment word)
        for j, tok in enumerate(context_tokens):
            if tok in NEGATION_WORDS:
                for w in context_tokens[j + 1: j + 4]:
                    if w in POSITIVE_WORDS:
                        pos_count = max(0, pos_count - 1)
                        neg_count += 1
                        break
                    if w in NEGATIVE_WORDS:
                        neg_count = max(0, neg_count - 1)
                        pos_count += 1
                        break

        if neg_count > pos_count:
            results[aspect_name] = "Negative"
        elif pos_count > neg_count:
            results[aspect_name] = "Positive"
        else:
            results[aspect_name] = "Neutral"

    return results


# ---------------------------------------------------------------------------
# Main analyzer
# ---------------------------------------------------------------------------

@dataclass
class SentimentAnalyzer:
    model: AutoModelForSequenceClassification
    tokenizer: AutoTokenizer
    label_mapping: Dict[int, SentimentClass]
    model_version: str

    def analyze(
        self,
        text: str,
        stars: Optional[int] = None,
        language_hint: Optional[str] = None,
    ) -> Dict[str, object]:
        raw_text = (text or "").strip()
        is_arabic = bool(re.search(r"[؀-ۿ]", raw_text))

        # --- Normalize ---
        norm_text = normalize_arabic(raw_text)
        tokens = tokenize_arabic(norm_text)

        # --- Detect language ---
        try:
            language = language_hint or (lang_detect(norm_text) if norm_text else "unknown")
        except Exception:
            language = "ar" if is_arabic else "unknown"

        # --- Model inference ---
        encoded = self.tokenizer(
            norm_text,
            truncation=True,
            max_length=256,
            padding=False,
            return_tensors="pt",
        )
        with torch.no_grad():
            outputs = self.model(**encoded)
            logits = outputs.logits.squeeze(0)
            probs_tensor = F.softmax(logits, dim=-1)

        probs: Dict[SentimentClass, float] = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
        for idx, p in enumerate(probs_tensor.cpu().tolist()):
            label = self.label_mapping.get(idx)
            if label:
                probs[label] += float(p)

        model_max_prob = max(probs.values())

        # --- Apply negation ---
        negated_tokens = get_negated_tokens(tokens)
        probs = apply_negation(tokens, probs)

        # --- Calibrate: gibberish / very short → use stars ---
        meaningful_tokens = [t for t in tokens if t not in STOP_WORDS and len(t) > 1]
        use_stars_fallback = is_gibberish(raw_text) or len(meaningful_tokens) < 3

        sentiment: SentimentClass = max(probs, key=probs.get)  # type: ignore[arg-type]

        # --- Low confidence → fall back to stars ---
        confidence = compute_confidence(tokens, raw_text, model_max_prob)

        star_fallback_used = False
        if stars is not None:
            star_sentiment = sentiment_from_stars(stars)
            if use_stars_fallback or confidence < 0.4:
                sentiment = star_sentiment
                star_fallback_used = True
            elif star_sentiment != sentiment:
                # Conflict between text and stars → neutral
                sentiment = "neutral"
                confidence = round(confidence * 0.75, 3)

        # --- Post-processing for mixed/contrast signals (Arabic and English) ---
        has_sentiment_tokens = bool(set(tokens) & (POSITIVE_WORDS | NEGATIVE_WORDS))
        if (is_arabic or has_sentiment_tokens) and not star_fallback_used:
            sentiment = self._arabic_postprocess(norm_text, tokens, probs, sentiment)

        # --- Calibrate low-confidence model (skip when star fallback overrides) ---
        if not star_fallback_used:
            sentiment = self._calibrate_sentiment(probs, sentiment)

        # --- Keywords (sentiment-bearing, excluding negated and issue nouns) ---
        keywords = extract_keywords(meaningful_tokens, excluded=negated_tokens)

        # --- Issues (always extract — positive reviews can still mention problems) ---
        issues = extract_issues(norm_text, tokens)

        # --- Aspect sentiment ---
        aspects = analyze_aspects(tokens, probs)

        # --- Final confidence + flag ---
        flag_for_review = confidence < 0.5

        # Capitalize output sentiment ("positive" → "Positive")
        sentiment_out = sentiment.capitalize()

        return {
            "sentiment": sentiment_out,
            "confidence": confidence,
            "keywords": keywords,
            "issues": issues,
            "aspects": aspects,
            "flag_for_review": flag_for_review,
            "score": float(probs.get(sentiment, 0.0)),
            "probs": {k.capitalize(): v for k, v in probs.items()},
            "language": language,
        }

    # ------------------------------------------------------------------
    # Post-processing helpers (kept from v1, extended)
    # ------------------------------------------------------------------

    def _arabic_postprocess(
        self,
        text: str,
        tokens: List[str],
        probs: Dict[SentimentClass, float],
        sentiment: SentimentClass,
    ) -> SentimentClass:
        t_norm = re.sub(r"\s+", " ", text)
        # Detect contrast words in both Arabic and English
        has_contrast = bool(re.search(r"(^|\s)(بس|لكن|but|however|although|though|yet)(\s|$)", t_norm, re.IGNORECASE))
        downplay_phrases = ["مش كتير", "مو كثير", "مش كثير", "مو كتير"]
        has_downplay = any(p in t_norm for p in downplay_phrases)
        has_neutral_phrase = bool(re.search(r"(^|\s)(عادي|مقبول|اوكي|أوكي)(\s|$)", t_norm))

        word_set = set(tokens)
        has_pos = bool(word_set & POSITIVE_WORDS)
        has_neg = bool(word_set & NEGATIVE_WORDS)
        is_mixed = has_pos and has_neg

        pos_p = probs.get("positive", 0.0)
        neu_p = probs.get("neutral", 0.0)
        close_pos_neu = abs(pos_p - neu_p) <= 0.12

        neg_p = probs.get("negative", 0.0)
        close_neg_neu = abs(neg_p - neu_p) <= 0.12

        if sentiment == "positive":
            if is_mixed:
                return "neutral"
            mixed_signal = has_pos and (has_downplay or has_neutral_phrase or has_contrast)
            overwhelmingly_positive = pos_p >= 0.9 and neu_p <= 0.05
            if mixed_signal and not overwhelmingly_positive:
                return "neutral"
            if (has_downplay or has_neutral_phrase or has_contrast) and close_pos_neu:
                return "neutral"

        if sentiment == "negative":
            if is_mixed:
                return "neutral"
            mixed_signal = has_neg and (has_downplay or has_neutral_phrase or has_contrast)
            overwhelmingly_negative = neg_p >= 0.9 and neu_p <= 0.05
            if mixed_signal and not overwhelmingly_negative:
                return "neutral"
            if (has_downplay or has_neutral_phrase or has_contrast) and close_neg_neu:
                return "neutral"

        return sentiment

    def _calibrate_sentiment(
        self,
        probs: Dict[SentimentClass, float],
        sentiment: SentimentClass,
    ) -> SentimentClass:
        pos_p = probs.get("positive", 0.0)
        neu_p = probs.get("neutral", 0.0)
        neg_p = probs.get("negative", 0.0)
        max_p = max(pos_p, neu_p, neg_p)

        if max_p < 0.45:
            return "neutral"
        if sentiment == "positive" and pos_p < 0.55 and neu_p >= 0.32 and neu_p >= neg_p - 0.05:
            return "neutral"
        if sentiment == "negative" and neg_p < 0.55 and neu_p >= 0.32 and neu_p >= pos_p - 0.05:
            return "neutral"
        return sentiment


def load_analyzer() -> SentimentAnalyzer:
    model_name = os.getenv("NLP_MODEL_NAME", "cardiffnlp/twitter-xlm-roberta-base-sentiment")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)

    id2label = getattr(model.config, "id2label", None) or {}
    label_mapping: Dict[int, SentimentClass] = {}
    for idx, raw_label in id2label.items():
        label_str = str(raw_label).lower()
        if "pos" in label_str:
            label_mapping[int(idx)] = "positive"
        elif "neg" in label_str:
            label_mapping[int(idx)] = "negative"
        else:
            label_mapping[int(idx)] = "neutral"

    if not label_mapping:
        label_mapping = {0: "negative", 1: "neutral", 2: "positive"}

    return SentimentAnalyzer(
        model=model,
        tokenizer=tokenizer,
        label_mapping=label_mapping,
        model_version=f"{model_name} | {CODE_VERSION}",
    )
