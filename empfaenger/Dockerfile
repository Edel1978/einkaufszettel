FROM python:3.12-slim

WORKDIR /app
COPY empfaenger.py .
# Dateien vom NAS kommen mit Rechten nur für den Besitzer an → für den Docker-Benutzer lesbar machen
RUN chmod -R a+rX /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/tmp \
    TZ=Europe/Berlin \
    EMPFAENGER_ORT=NAS

CMD ["python", "/app/empfaenger.py", "/listen", "8000"]
