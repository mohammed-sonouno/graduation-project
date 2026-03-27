from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Literal, Optional

import re
from langdetect import detect as lang_detect
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch
import torch.nn.functional as F


SentimentClass = Literal["positive", "neutral", "negative"]
CODE_VERSION = "GP-NLP-AR-MIXED-V1"


@dataclass
class SentimentAnalyzer:
  model: AutoModelForSequenceClassification
  tokenizer: AutoTokenizer
  label_mapping: Dict[int, SentimentClass]
  model_version: str

  def _is_arabic_text(self, text: str) -> bool:
    return bool(text) and any("\u0600" <= ch <= "\u06FF" for ch in text)

  def _collapse_exaggerated_repeats(self, text: str, is_arabic: bool) -> str:
    """
    Conservative normalization for user-typed exaggeration:
    - Arabic: collapse any 3+ run to 1 (كووويس -> كويس)
    - Latin: collapse any 3+ run to 2 (goooood -> good), preserves legitimate doubles.
    """
    s = (text or "").strip()
    if not s:
      return s
    if is_arabic:
      return re.sub(r"([\u0600-\u06FF])\1{2,}", r"\1", s)
    return re.sub(r"([A-Za-z])\1{2,}", r"\1\1", s)

  def _arabic_postprocess(
    self,
    text: str,
    probs: Dict[SentimentClass, float],
    sentiment: SentimentClass,
  ) -> SentimentClass:
    """
    Post-processing rules for Arabic to reduce overly-optimistic positives on mixed comments.
    Keeps the transformer model, but biases toward neutral when contrast/downplay is present.
    """
    t = (text or "").strip()
    if not t:
      return sentiment

    # Normalize spacing for phrase checks
    t_norm = re.sub(r"\s+", " ", t)

    # Contrast words: "but/however"
    has_contrast = bool(re.search(r"(^|\s)(بس|لكن)(\s|$)", t_norm))

    # Downplaying / softening phrases (Arabic + common English)
    downplay_phrases = [
      "مش كتير",
      "مو كثير",
      "مش كثير",
      "مو كتير",
      "kind of",
      "kinda",
      "somewhat",
    ]
    has_downplay = any(phrase in t_norm for phrase in downplay_phrases)

    # Neutral/okay-ish words
    has_neutral_phrase = bool(
      re.search(r"(^|\s)(عادي|مقبول|اوكي|أوكي|okay)(\s|$)", t_norm, flags=re.IGNORECASE)
    )

    # Tiny lexicon for "mixed" detection (kept intentionally small to avoid false positives)
    pos_words = {"جيد", "منيح", "حلو", "ممتاز", "رائع", "جميل", "كويس", "مفيد"}
    neg_words = {"سيء", "سيئ", "وحش", "زفت", "مش كويس", "مو كويس", "مش جيد", "مو جيد"}
    words = set(re.findall(r"[\u0600-\u06FF]+", t_norm))
    has_pos = any(w in words for w in pos_words)
    has_neg = any(w in words for w in neg_words)
    is_mixed_lexicon = has_pos and has_neg

    pos_p = float(probs.get("positive", 0.0))
    neu_p = float(probs.get("neutral", 0.0))

    # If positive & neutral are close and the text looks mixed/hedged, prefer neutral.
    close_pos_neu = abs(pos_p - neu_p) <= 0.12

    # Debug hook when NLP_DEBUG is enabled
    if os.getenv("NLP_DEBUG", "").lower() in {"1", "true"}:
      print(
        "[nlp-ar-debug]",
        {
          "text": t_norm,
          "sentiment_before": sentiment,
          "probs": probs,
          "has_contrast": has_contrast,
          "has_downplay": has_downplay,
          "has_neutral_phrase": has_neutral_phrase,
          "has_pos": has_pos,
          "has_neg": has_neg,
          "is_mixed_lexicon": is_mixed_lexicon,
          "close_pos_neu": close_pos_neu,
        },
        flush=True,
      )

    if sentiment == "positive":
      # If explicitly mixed lexicon, always neutral.
      if is_mixed_lexicon:
        return "neutral"

      # Strong mixed/hedged signal: positive words + downplay/contrast/neutral-ish phrases.
      mixed_signal = has_pos and (has_downplay or has_neutral_phrase or has_contrast)

      # Only keep positive if the model is *extremely* confident and neutral is very low.
      overwhelmingly_positive = pos_p >= 0.9 and neu_p <= 0.05

      # For our use case, mixed_signal should almost always become neutral.
      if mixed_signal and not overwhelmingly_positive:
        return "neutral"

      # Even without explicit positive lexicon, if text is hedged and probs are close, prefer neutral.
      if (has_downplay or has_neutral_phrase or has_contrast) and close_pos_neu:
        return "neutral"

    return sentiment

  def _calibrate_sentiment(
    self,
    probs: Dict[SentimentClass, float],
    sentiment: SentimentClass,
  ) -> SentimentClass:
    """
    Lightweight confidence-based calibration shared by all languages.
    - Very low overall confidence -> neutral
    - Borderline positives/negatives with strong neutral probability -> neutral
    """
    pos_p = float(probs.get("positive", 0.0))
    neu_p = float(probs.get("neutral", 0.0))
    neg_p = float(probs.get("negative", 0.0))

    max_p = max(pos_p, neu_p, neg_p)

    # If the model is very uncertain overall, treat as neutral.
    if max_p < 0.45:
      return "neutral"

    # If we predicted positive/negative but neutral is strong and close,
    # prefer neutral to avoid over-confident polarity.
    if sentiment == "positive":
      if pos_p < 0.55 and neu_p >= 0.32 and neu_p >= neg_p - 0.05:
        return "neutral"
    elif sentiment == "negative":
      if neg_p < 0.55 and neu_p >= 0.32 and neu_p >= pos_p - 0.05:
        return "neutral"

    return sentiment

  def detect_language(self, text: str, hint: Optional[str] = None) -> str:
    if hint:
      return hint.lower()
    try:
      return lang_detect(text)
    except Exception:  # pragma: no cover - defensive
      return "unknown"

  def analyze(self, text: str, language_hint: Optional[str] = None) -> Dict[str, object]:
    # Normalize exaggerated repeats before language detection + model inference.
    is_arabic_hint = (language_hint or "").lower() == "ar" or self._is_arabic_text(text)
    pre_text = self._collapse_exaggerated_repeats(text, is_arabic=is_arabic_hint)

    language = self.detect_language(pre_text, hint=language_hint)
    encoded = self.tokenizer(
      pre_text,
      truncation=True,
      max_length=256,
      padding=False,
      return_tensors="pt",
    )
    with torch.no_grad():
      outputs = self.model(**encoded)
      logits = outputs.logits.squeeze(0)
      probs_tensor = F.softmax(logits, dim=-1)

    probs = probs_tensor.cpu().tolist()
    # Map model indices to our canonical labels
    probs_dict: Dict[SentimentClass, float] = {lbl: 0.0 for lbl in ["positive", "neutral", "negative"]}
    for idx, p in enumerate(probs):
      label = self.label_mapping.get(idx)
      if label:
        probs_dict[label] += float(p)

    # Primary sentiment is argmax of aggregated probs
    sentiment: SentimentClass = max(probs_dict, key=probs_dict.get)  # type: ignore[arg-type]
    # Arabic post-processing to reduce overly-positive mixed comments.
    if language == "ar" or is_arabic_hint:
      sentiment = self._arabic_postprocess(pre_text, probs_dict, sentiment)

    # Language-agnostic confidence calibration.
    sentiment = self._calibrate_sentiment(probs_dict, sentiment)

    score = float(probs_dict.get(sentiment, 0.0))

    return {
      "sentiment": sentiment,
      "score": score,
      "probs": probs_dict,
      "language": language,
    }


def load_analyzer() -> SentimentAnalyzer:
  """
  Load a multilingual sentiment model suitable for Arabic + English.

  We use a Hugging Face model that supports multiple languages. The specific checkpoint
  can be overridden via the NLP_MODEL_NAME environment variable.
  """
  model_name = os.getenv("NLP_MODEL_NAME", "cardiffnlp/twitter-xlm-roberta-base-sentiment")

  tokenizer = AutoTokenizer.from_pretrained(model_name)
  model = AutoModelForSequenceClassification.from_pretrained(model_name)

  # Many sentiment models expose labels in config.id2label. Normalize them.
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

  # Fallback mapping if config doesn't provide labels
  if not label_mapping:
    label_mapping = {
      0: "negative",
      1: "neutral",
      2: "positive",
    }

  model_version = f"{model_name} | {CODE_VERSION}"

  return SentimentAnalyzer(
    model=model,
    tokenizer=tokenizer,
    label_mapping=label_mapping,
    model_version=model_version,
  )

