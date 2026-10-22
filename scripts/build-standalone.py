"""把静态源文件打成可直接打开的单文件 HTML，无第三方依赖"""
from pathlib import Path
import base64
import re
import sys

root = Path(__file__).resolve().parent.parent
target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / "outputs" / "salary-calculator.html"
html = (root / "index.html").read_text()
css = (root / "styles.css").read_text()

def embed_font(match):
    data = base64.b64encode((root / match.group(1).split("?")[0]).read_bytes()).decode("ascii")
    return f'url("data:font/woff2;base64,{data}")'

css = re.sub(r'url\((fonts/[^)]+)\)', embed_font, css)
html = re.sub(r'<link rel="stylesheet" href="styles\.css(?:\?[^"]*)?">', lambda _: f'<style>\n{css}\n</style>', html)

def embed_script(match):
    source = (root / match.group(1).split("?")[0]).read_text().replace('</script', '<\\/script')
    return f'<script>\n{source}\n</script>'

html = re.sub(r'<script src="([^"]+)"></script>', embed_script, html)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(html)
print(f"Standalone HTML: {target}")
