# ===============================
# EDMS Backend Dockerfile
# ===============================

# ---- Base Python image ----
FROM python:3.12-slim

# ---- Set working directory ----
WORKDIR /app

# ---- System dependencies (needed for faiss) ----
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ---- Copy requirements first (better caching) ----
COPY requirements.txt .

# ---- Install Python dependencies ----
RUN pip install --no-cache-dir -r requirements.txt

# ---- Copy application code ----
COPY src ./src
COPY data ./data

# ---- Expose FastAPI port ----
EXPOSE 8000

# ---- Start FastAPI server ----
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
