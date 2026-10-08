import asyncio
import base64
import json
import pathlib
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = pathlib.Path('F:/unaware-of-my-demise')
OUT = ROOT / '.local/migration-20261008'
LAUNCHER = 'C:/Users/PC/AppData/Local/uv/cache/archive-v0/-vl-Aidn0rzTBoaY/Scripts/godot-ai.exe'
WRAPPER = 'import subprocess,sys; raise SystemExit(subprocess.call(sys.argv[1:], stdin=sys.stdin, stdout=sys.stdout, stderr=sys.stderr, creationflags=0x08000000))'

def clean(value):
    if isinstance(value, dict):
        return {k: '[omitted]' if k.lower() in ('data', 'base64', 'token', 'capability', 'bearer', 'authorization') else clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value

async def main():
    server = StdioServerParameters(command='C:/Users/PC/AppData/Local/Python/pythoncore-3.14-64/pythonw.exe', args=['-c', WRAPPER, LAUNCHER, 'attach', '--port', '8000', '--ws-port', '9500', '--disable-telemetry'], cwd=str(ROOT / 'game'))
    with (OUT / 'mcp-attach.log').open('a', encoding='utf-8') as errors:
        async with stdio_client(server, errlog=errors) as (reader, writer):
            async with ClientSession(reader, writer) as client:
                await client.initialize()
                if len(sys.argv) == 1 or sys.argv[1] == 'list':
                    listed = await client.list_tools()
                    data = [tool.model_dump(mode='json') for tool in listed.tools]
                    (OUT / 'godot-tools.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
                    relevant = [tool for tool in data if tool['name'] in ('editor_state', 'session_activate', 'project_run', 'game_manage', 'editor_screenshot', 'logs_read')]
                    print(json.dumps(relevant, indent=2))
                    return
                tool, argfile, tag = sys.argv[1:4]
                arguments = json.loads(pathlib.Path(argfile).read_text(encoding='utf-8'))
                result = await client.call_tool(tool, arguments=arguments)
                data = result.model_dump(mode='json')
                for index, block in enumerate(data.get('content', [])):
                    if block.get('type') == 'image':
                        suffix = '.png' if block.get('mimeType') == 'image/png' else '.jpg'
                        path = OUT / (tag + '-' + str(index) + suffix)
                        path.write_bytes(base64.b64decode(block['data']))
                        block['data'] = '[saved to ' + path.name + ']'
                    elif block.get('type') == 'text':
                        try:
                            block['text'] = json.dumps(clean(json.loads(block['text'])), ensure_ascii=False)
                        except ValueError:
                            pass
                data = clean(data)
                (OUT / (tag + '.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
                print(json.dumps(data, ensure_ascii=False)[:3500])
                if data.get('isError') or data.get('is_error'):
                    raise SystemExit(1)

asyncio.run(asyncio.wait_for(main(), timeout=75))
