from pathlib import Path
import re

content = Path(r"artifacts/failure_20260927_203230.html").read_text(encoding="utf-8", errors="replace")
print("Title:", re.findall(r"<title>(.*?)</title>", content, re.I))
m = re.search(r"<body[^>]*>(.*)", content, re.S)
if m:
    print("Body snippet:")
    print(m.group(1)[:2000])
