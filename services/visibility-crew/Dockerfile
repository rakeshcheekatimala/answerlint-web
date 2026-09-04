FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CREWAI_STORAGE_DIR=/tmp/answerlint-crewai

RUN addgroup --system answerlint && adduser --system --ingroup answerlint answerlint
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv==0.7.12 \
    && uv sync --frozen --no-dev

COPY src ./src
RUN mkdir -p /tmp/answerlint-crewai \
    && chown -R answerlint:answerlint /app /tmp/answerlint-crewai

USER answerlint
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD [".venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/health', timeout=3)"]

CMD [".venv/bin/uvicorn", "answerlint_visibility_crew.api:app", "--host", "0.0.0.0", "--port", "8010", "--no-server-header"]
