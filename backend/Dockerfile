FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for pdfplumber and other libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render exposes the PORT environment variable
ENV PORT=10000
EXPOSE $PORT

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
