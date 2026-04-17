#!/bin/bash
# Start (or restart) the trigger HTTP server. Keep this running to enable
# the manual "scan now" buttons on the website.
cd "$(dirname "$0")"
pkill -f trigger_server.py 2>/dev/null
sleep 1
nohup /usr/bin/python3 trigger_server.py > /tmp/peter-brandt-trigger.log 2>&1 &
sleep 2
echo "✓ Trigger service started on http://127.0.0.1:8800"
echo "  Logs: /tmp/peter-brandt-trigger.log"
echo "  Stop: pkill -f trigger_server.py"
echo ""
echo "Keep this running for manual update buttons to work on the website."
sleep 3
