import asyncio
import json
import os
import httpx
from godot_ai.transport.capability import read_capabilities, record_path

async def main():
    record = read_capabilities(8000)
    path = record_path(8000)
    print(json.dumps({'record_present': record is not None, 'record_mtime': path.stat().st_mtime if path.exists() else None, 'capability_env_keys': [key for key in os.environ if 'GODOT_AI' in key or key in ('LOCALAPPDATA',)]}))
    if record:
        async with httpx.AsyncClient(trust_env=False) as client:
            response = await client.get('http://127.0.0.1:8000/godot-ai/status', headers={'Authorization': 'Bearer ' + record.http}, timeout=5)
            print(json.dumps({'record_authenticated_status': response.status_code}))

asyncio.run(main())
