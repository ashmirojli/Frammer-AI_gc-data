# ============================================================================
#  GCData Analytics — FastAPI Backend
#  Multi-stage Docker build
# ============================================================================

FROM python:3.11-slim AS base

# ── System deps required by vowpalwabbit, scikit-learn, pandas, etc. ────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        libboost-all-dev \
        zlib1g-dev \
        git \
    && rm -rf /var/lib/apt/lists/*

# ── Set working directory to project root inside container ──────────────────
WORKDIR /app

# ── Install Python dependencies first (layer cache optimisation) ────────────
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/backend/requirements.txt

# ── Copy StarSchemaDB CSVs and backend source code ──────────────────────────
COPY StarSchemaDB/ /app/StarSchemaDB/
COPY backend/      /app/backend/

# ── Run ETL at build time to bake analytics and knowledge base into the image ──
RUN python /app/backend/scripts/etl_to_sqlite.py \
    && python /app/backend/RAG/knowledge_base.py

# ── Expose Cloud Run default port ───────────────────────────────────────────
EXPOSE 8080

# ── Start the FastAPI server ────────────────────────────────────────────────
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
