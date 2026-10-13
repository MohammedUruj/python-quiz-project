#!/usr/bin/env python3
"""Start the TQM Tyre Factory Simulator.

    python run.py              # play on this computer (opens your browser)
    python run.py --lan        # let other computers on your network join
    python run.py --port 9000  # use a different port

No installation is needed: only Python 3.9 or newer.
"""

import argparse
import os
import secrets
import socket
import sys
import threading
import webbrowser
from pathlib import Path

if sys.version_info < (3, 9):
    sys.exit("Python 3.9 or newer is required. Download it from https://www.python.org/downloads/")

from tqm_server.app import make_server  # noqa: E402

ROOT = Path(__file__).resolve().parent


def load_host_pin(data_dir):
    """Host PIN: TQM_HOST_PIN environment variable, else a random PIN saved in data/host_pin.txt."""
    env_pin = os.environ.get("TQM_HOST_PIN", "").strip()
    if env_pin:
        return env_pin
    pin_file = data_dir / "host_pin.txt"
    if pin_file.exists() and pin_file.read_text().strip():
        return pin_file.read_text().strip()
    pin = "".join(secrets.choice("0123456789") for _ in range(8))
    data_dir.mkdir(parents=True, exist_ok=True)
    pin_file.write_text(pin + "\n")
    return pin


def lan_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "your-computer-ip"


def main():
    parser = argparse.ArgumentParser(description="TQM Tyre Factory Simulator server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("TQM_PORT") or os.environ.get("PORT") or 8000))
    parser.add_argument("--lan", action="store_true", help="allow other devices on the network to connect")
    parser.add_argument("--host", default=None, help="advanced: exact address to bind")
    parser.add_argument("--data-dir", default=os.environ.get("TQM_DATA_DIR", str(ROOT / "data")))
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser window")
    args = parser.parse_args()

    bind = args.host or ("0.0.0.0" if args.lan else "127.0.0.1")
    data_dir = Path(args.data_dir)
    pin = load_host_pin(data_dir)
    try:
        server = make_server(bind, args.port, data_dir, pin)
    except OSError as exc:
        sys.exit(f"Could not start on port {args.port} ({exc}). Try: python run.py --port 8080")

    local_url = f"http://localhost:{args.port}/"
    print("=" * 64)
    print(" TQM TYRE FACTORY SIMULATOR is running")
    print(f"   Play:            {local_url}")
    print(f"   Host dashboard:  {local_url}host")
    if bind == "0.0.0.0":
        print(f"   Participants on your network: http://{lan_address()}:{args.port}/")
    print(f"   Host PIN:        {pin}")
    print(f"   Results saved in {data_dir / 'tqm_results.sqlite3'}")
    print(" Press Ctrl+C to stop.")
    print("=" * 64)

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(local_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server. Goodbye!")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
