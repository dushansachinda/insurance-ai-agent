FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bureau_alpha.py .
COPY bureau_beta.py .

# CMD is overridden per service in docker-compose.yml
CMD ["uvicorn", "bureau_alpha:app", "--host", "0.0.0.0", "--port", "8004"]
