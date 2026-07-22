# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy the rest of the frontend source
COPY frontend/ .

# Build the frontend (Vite outputs to /app/frontend/dist)
RUN npm run build


# Stage 2: Build the FastAPI Backend & Serve Frontend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies required for pdfplumber and other backend tools
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy the rest of the backend source
COPY backend/ ./backend/

# Copy the built frontend static assets from Stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Render provides the PORT environment variable dynamically (defaults to 10000)
ENV PORT=10000
EXPOSE $PORT

# Start Uvicorn, pointing to the main.py inside the backend directory
WORKDIR /app/backend
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
