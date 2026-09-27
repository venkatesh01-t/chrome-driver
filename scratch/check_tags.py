from pathlib import Path
import re

content = Path(r"artifacts/failure_20260927_203230.html").read_text(encoding="utf-8", errors="replace")

# Print the gt-sidebar block
m = re.search(r"<gt-sidebar.*?</gt-sidebar>", content, re.S)
if m:
    print("--- GT-SIDEBAR HTML ---")
    print(m.group(0)[:5000])
else:
    # Print around mainSidebar
    pos = content.find('mainSidebar')
    if pos != -1:
        print("--- mainSidebar area ---")
        print(content[pos-100:pos+3000])
