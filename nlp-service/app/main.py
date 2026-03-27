import os
from typing import Literal, Dict, Optional

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


class SentimentLabel(BaseModel):
  sentiment: Literal["positive", "neutral", "negative"]
  score: float
  probs: Dict[Literal["positive", "neutral", "negative"], float]
  language: str
  model_version: str


app = FastAPI(
  title="University Event NLP Service",
  version="1.0.0",
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
  # Health should work even if the model isn't downloaded yet.
  global _analyzer
  if _analyzer is None:
    # fall back to env-based model name
    model_version = os.getenv("NLP_MODEL_NAME", "cardiffnlp/twitter-xlm-roberta-base-sentiment")
    return HealthResponse(status="ok", model_version=model_version, model_loaded=False)
  # When loaded, expose the analyzer's model_version (includes our code marker).
  return HealthResponse(status="ok", model_version=_analyzer.model_version, model_loaded=True)


@app.post("/analyze-sentiment", response_model=SentimentLabel)
def analyze_sentiment(payload: SentimentRequest) -> SentimentLabel:
  text = (payload.text or "").strip()
  if not text:
    raise HTTPException(status_code=400, detail="text must be a non-empty string")

  analyzer = get_analyzer()
  try:
    result = analyzer.analyze(text, language_hint=payload.language_hint)
  except Exception as exc:  # pragma: no cover - defensive
    raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {exc}") from exc

  return SentimentLabel(
    sentiment=result["sentiment"],
    score=result["score"],
    probs=result["probs"],
    language=result["language"],
    model_version=analyzer.model_version,
  )


if __name__ == "__main__":
  import uvicorn

  host = os.getenv("NLP_SERVICE_HOST", "0.0.0.0")
  port = int(os.getenv("NLP_SERVICE_PORT", "8001"))
  uvicorn.run("app.main:app", host=host, port=port, reload=True)

