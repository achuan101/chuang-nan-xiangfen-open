#!/usr/bin/env python3
"""
Cocos MCP 简易交互与调试客户端
连接运行在 http://127.0.0.1:8765/mcp 的 cocos-mcp-3x 服务端，直接驱动与调试当前打开的 Cocos Creator 3.8 编辑器。

用法：
  python tools/cocos_mcp_cli.py info
  python tools/cocos_mcp_cli.py console [--action get|clear] [--levels log,info,warn,error]
  python tools/cocos_mcp_cli.py scene [current | list | open <scene_url> | save]
  python tools/cocos_mcp_cli.py node [tree | selection]
  python tools/cocos_mcp_cli.py eval "<js_code>" [--target scene|main]
"""

import sys
import json
import urllib.request
import urllib.error

MCP_URL = "http://127.0.0.1:8765/mcp"

def call_mcp(method: str, params: dict, session_id: str | None = None) -> tuple[dict | None, str | None]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    if session_id:
        headers["mcp-session-id"] = session_id

    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
        headers=headers
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            sid = resp.headers.get("mcp-session-id") or session_id
            text = resp.read().decode()
            for line in text.splitlines():
                if line.startswith("data: "):
                    return json.loads(line[6:]), sid
    except urllib.error.HTTPError as e:
        print(f"[HTTP Error {e.code}] {e.read().decode()}", file=sys.stderr)
    except Exception as e:
        print(f"[Error] {e}", file=sys.stderr)
    return None, session_id

class CocosMcpClient:
    def __init__(self):
        self.sid = None

    def connect(self) -> bool:
        res, sid = call_mcp("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "cocos-mcp-cli", "version": "1.0"}
        })
        if not sid:
            print("连接 MCP 服务端失败，请确认 extensions/cocos-mcp-3x 服务已启动 (http://127.0.0.1:8765)")
            return False
        self.sid = sid
        call_mcp("notifications/initialized", {}, session_id=sid)
        return True

    def tool_call(self, name: str, args: dict) -> dict | None:
        res, _ = call_mcp("tools/call", {"name": name, "arguments": args}, session_id=self.sid)
        if not res:
            return None
        if res.get("result", {}).get("isError"):
            print(f"Tool Error: {res['result'].get('content')}", file=sys.stderr)
            return None
        # 解析 content 内部的 JSON 字符串
        content = res.get("result", {}).get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except Exception:
                return {"text": content[0]["text"]}
        return res.get("result")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1].lower()
    client = CocosMcpClient()
    if not client.connect():
        sys.exit(1)

    if cmd == "info":
        res = client.tool_call("get_project_info", {})
        print(json.dumps(res, ensure_ascii=False, indent=2))

    elif cmd == "console":
        action = "get"
        levels = None
        for i, arg in enumerate(sys.argv[2:]):
            if arg == "--action" and i + 3 < len(sys.argv):
                action = sys.argv[i + 3]
            if arg == "--levels" and i + 3 < len(sys.argv):
                levels = sys.argv[i + 3].split(",")
        params = {"action": action}
        if levels:
            params["levels"] = levels
        res = client.tool_call("read_console", params)
        print(json.dumps(res, ensure_ascii=False, indent=2))

    elif cmd == "scene":
        sub = sys.argv[2] if len(sys.argv) > 2 else "current"
        if sub in ("current", "list", "save"):
            res = client.tool_call("manage_scene", {"action": sub})
            print(json.dumps(res, ensure_ascii=False, indent=2))
        elif sub == "open" and len(sys.argv) > 3:
            url = sys.argv[3]
            res = client.tool_call("manage_scene", {"action": "open", "url": url})
            print(json.dumps(res, ensure_ascii=False, indent=2))
        else:
            print("用法: scene current | scene list | scene open <url> | scene save")

    elif cmd == "node":
        sub = sys.argv[2] if len(sys.argv) > 2 else "tree"
        res = client.tool_call("manage_node", {"action": sub})
        print(json.dumps(res, ensure_ascii=False, indent=2))

    elif cmd == "eval":
        if len(sys.argv) < 3:
            print("用法: eval '<js_code>' [--target scene|main]")
            return
        code = sys.argv[2]
        target = "scene"
        if len(sys.argv) > 4 and sys.argv[3] == "--target":
            target = sys.argv[4]
        res = client.tool_call("execute_script", {"code": code, "target": target})
        print(json.dumps(res, ensure_ascii=False, indent=2))

    else:
        print(f"未知子命令: {cmd}")
        print(__doc__)

if __name__ == "__main__":
    main()
