poetry run python -m backend.migrate && poetry run uvicorn backend.api.main:app --reload --port 4000
