# Deployment

The simulator is a single Python process with no third-party dependencies. It serves the game, the host
dashboard and the API, and stores results in SQLite under `data/`.

## Option 1: trainer laptop (simplest)

```
python run.py --lan
```

Participants join over the local network. Results stay on the laptop in `data/tqm_results.sqlite3`.

## Option 2: a server or virtual machine

```
export TQM_HOST_PIN="a-long-pin-you-choose"
python3 run.py --host 0.0.0.0 --port 8000 --no-browser
```

- Put it behind a reverse proxy with **HTTPS** (for example Caddy or nginx) if it is reachable from the internet,
  so the host PIN and participant names are encrypted in transit.
- Keep `data/` on persistent storage and back it up.
- To keep it running after you log out, use your platform's service manager (systemd, a Windows service, or a
  process manager).

Environment variables:

| Variable | Meaning | Default |
|---|---|---|
| `TQM_HOST_PIN` | Host dashboard PIN | Random 8-digit PIN saved in `data/host_pin.txt` |
| `TQM_PORT` or `PORT` | Port | 8000 |
| `TQM_DATA_DIR` | Where results are stored | `./data` |

## Option 3: Docker

```
docker build -t tqm-sim .
docker run -d -p 8000:8000 -e TQM_HOST_PIN=choose-a-pin -v tqm-data:/app/data tqm-sim
```

## Capacity

The built-in server is multi-threaded and comfortably handles a classroom (dozens of simultaneous players): the
game runs in each browser, and the server is only contacted to load the assessment and save results.

## Static hosting

The game's practice levels work from any static web host (the `web/` folder), but the final assessment, saved
results and host dashboard need the Python server.
