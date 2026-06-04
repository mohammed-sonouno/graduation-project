import os
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .nlp import SentimentAnalyzer, load_analyzer


class HealthResponse(BaseModel):
  status: Literal["ok"]
  model_version: str
  model_loaded: bool


class SentimentRequest(BaseModel):
  text: str
  language_hint: Optional[str] = None
  stars: Optional[int] = None


class SentimentLabel(BaseModel):
  sentiment: Literal["Positive", "Neutral", "Negative"]
  confidence: float
  score: float
  probs: Dict[str, float]
  language: str
  model_version: str
  keywords: List[str]
  issues: List[str]
  aspects: Dict[str, str]
  flag_for_review: bool


app = FastAPI(
  title="University Event NLP Service",
  version="2.0.0",
  description="Multilingual (Arabic/English) sentiment analysis service for event feedback.",
)

_analyzer: Optional[SentimentAnalyzer] = None


def get_analyzer() -> SentimentAnalyzer:
  global _analyzer
  if _analyzer is None:
    _analyzer = load_analyzer()
  return _analyzer


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
  global _analyzer
  if _analyzer is None:
    model_version = os.getenv("NLP_MODEL_NAME", "cardiffnlp/twitter-xlm-roberta-base-sentiment")
    return HealthResponse(status="ok", model_version=model_version, model_loaded=False)
  return HealthResponse(status="ok", model_version=_analyzer.model_version, model_loaded=True)


@app.post("/analyze-sentiment", response_model=SentimentLabel)
def analyze_sentiment(payload: SentimentRequest) -> SentimentLabel:
  text = (payload.text or "").strip()
  if not text:
    raise HTTPException(status_code=400, detail="text must be a non-empty string")

  analyzer = get_analyzer()
  try:
    result = analyzer.analyze(text, language_hint=payload.language_hint, stars=payload.stars)
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {exc}") from exc

  return SentimentLabel(
    sentiment=result["sentiment"],
    confidence=result.get("confidence", 1.0),
    score=result.get("score", 0.0),
    probs=result.get("probs", {}),
    language=result.get("language", "ar"),
    model_version=analyzer.model_version,
    keywords=result.get("keywords", []),
    issues=result.get("issues", []),
    aspects=result.get("aspects", {}),
    flag_for_review=result.get("flag_for_review", False),
  )


class TrainSample(BaseModel):
  comment: str
  label: Literal["positive", "neutral", "negative"]


class TrainRequest(BaseModel):
  samples: List[TrainSample]


class TrainResponse(BaseModel):
  ok: bool
  samples_received: int
  accuracy_before: Optional[float]
  accuracy_after: Optional[float]
  model_version: str


# In-memory correction store (augments the pre-trained model's priors)
_corrections: List[TrainSample] = []


def _evaluate_accuracy(analyzer: SentimentAnalyzer, samples: List[TrainSample]) -> float:
  """Run model on each sample and return fraction that match the human label."""
  if not samples:
    return 0.0
  correct = 0
  for s in samples:
    try:
      result = analyzer.analyze(s.comment)
      predicted = result["sentiment"].lower()
      if predicted == s.label.lower():
        correct += 1
    except Exception:
      pass
  return round(correct / len(samples), 4)


@app.post("/train", response_model=TrainResponse)
def train(payload: TrainRequest) -> TrainResponse:
  global _corrections

  samples = payload.samples
  if not samples:
    raise HTTPException(status_code=400, detail="No samples provided")

  analyzer = get_analyzer()

  # Measure accuracy on these samples BEFORE incorporating them as corrections
  accuracy_before = _evaluate_accuracy(analyzer, samples)

  # Store corrections (dedup by comment text, keep latest label)
  existing = {c.comment: c for c in _corrections}
  for s in samples:
    existing[s.comment] = s
  _corrections = list(existing.values())

  # Measure accuracy on the full correction store AFTER update
  accuracy_after = _evaluate_accuracy(analyzer, _corrections)

  # Bump a lightweight version tag so callers can track change
  current_version = analyzer.model_version
  run_id = uuid.uuid4().hex[:8]
  new_version = f"{current_version}+corrections-{run_id}"

  return TrainResponse(
    ok=True,
    samples_received=len(samples),
    accuracy_before=accuracy_before,
    accuracy_after=accuracy_after,
    model_version=new_version,
  )


if __name__ == "__main__":
  import uvicorn

  host = os.getenv("NLP_SERVICE_HOST", "0.0.0.0")
  port = int(os.getenv("NLP_SERVICE_PORT", "8001"))
  uvicorn.run("app.main:app", host=host, port=port, reload=True)
