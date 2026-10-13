# Optional: run the simulator in a container.
#   docker build -t tqm-sim .
#   docker run -p 8000:8000 -e TQM_HOST_PIN=choose-a-pin -v tqm-data:/app/data tqm-sim
FROM python:3.12-slim
WORKDIR /app
COPY run.py run_tests.py ./
COPY tqm_server ./tqm_server
COPY web ./web
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
VOLUME ["/app/data"]
CMD ["python", "run.py", "--host", "0.0.0.0", "--no-browser"]
