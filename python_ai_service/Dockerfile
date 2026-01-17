FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir uv

COPY python_ai_service/pyproject.toml /app/pyproject.toml

RUN uv sync --no-dev

COPY python_ai_service/app /app/app

EXPOSE 8000

CMD ["uv", "run", "python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
