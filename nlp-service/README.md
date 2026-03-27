# University Event NLP Service

This directory contains a standalone **FastAPI** service that provides
multilingual (Arabic/English) sentiment analysis for event feedback.

> **Note:** This service is NOT yet integrated with the Node/Express backend.
> Review submission and the dashboard continue to work as before.

## Folder structure

```text
nlp-service/
  app/
    __init__.py        # package marker (optional, can be empty)
    main.py            # FastAPI entrypoint (health + analyze-sentiment)
    nlp.py             # SentimentAnalyzer implementation and model loader
  requirements.txt     # Python dependencies
  README.md            # This file
```

## Endpoints

### GET /health

Simple health check.

**Response**

```json
{
  "status": "ok",
  "model_version": "cardiffnlp/twitter-xlm-roberta-base-sentiment"
}
```

### POST /analyze-sentiment

Analyze the sentiment of a single text sample.

**Request body**

```json
{
  "text": "Great event, amazing speakers!",
  "language_hint": "en"
}
```

- `text` (string, required): the review/comment text to analyze.
- `language_hint` (string, optional): ISO language code such as `"en"` or `"ar"`.

**Response body**

```json
{
  "sentiment": "positive",
  "score": 0.91,
  "probs": {
    "positive": 0.91,
    "neutral": 0.07,
    "negative": 0.02
  },
  "language": "en",
  "model_version": "cardiffnlp/twitter-xlm-roberta-base-sentiment"
}
```

- `sentiment`: one of `"positive"`, `"neutral"`, `"negative"`.
- `score`: confidence score for the predicted sentiment (0–1).
- `probs`: probability distribution over the three sentiment classes.
- `language`: detected (or hinted) language code.
- `model_version`: identifier of the underlying model/checkpoint.

## Required Python packages

All dependencies are listed in `requirements.txt`:

- `fastapi`
- `uvicorn[standard]`
- `transformers`
- `torch`
- `sentencepiece`
- `langdetect`
- `python-dotenv`

Install them into a virtual environment before running the service.

```bash
cd nlp-service
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Running the service locally

From the project root or `nlp-service` directory:

```bash
cd nlp-service
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Environment variables:

- `NLP_MODEL_NAME` (optional): override the Hugging Face model name.
- `NLP_SERVICE_HOST` / `NLP_SERVICE_PORT` (optional): if running via `python app/main.py`.

Once running, you can test the service:

```bash
curl http://localhost:8001/health

curl -X POST http://localhost:8001/analyze-sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "The event was excellent", "language_hint": "en"}'
```

## Integration status

- This service is currently **standalone**.
- No changes have been made to:
  - The Node/Express backend.
  - The review submission flow.
  - The dashboard or frontend pages.

When you're ready for Phase 3, the Node backend can start calling
`POST /analyze-sentiment` from the review submission handler.

