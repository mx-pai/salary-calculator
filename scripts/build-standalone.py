"""把静态源文件打成可直接打开的单文件 HTML，无第三方依赖"""
from pathlib import Path
import base64
import re
import mimetypes
import sys

root = Path(__file__).resolve().parent.parent
target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / "outputs" / "salary-calculator.html"
html = (root / "index.html").read_text()
css = (root / "styles.css").read_text()

def asset_data(path):
    path = path.split("?")[0]
    mime = "font/woff2" if path.endswith(".woff2") else mimetypes.guess_type(path)[0]
    data = base64.b64encode((root / path).read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"

css = re.sub(r'url\(((?:fonts|assets)/[^)]+)\)', lambda match: f'url("{asset_data(match.group(1))}")', css)
html = re.sub(r'src="(assets/[^"]+)"', lambda match: f'src="{asset_data(match.group(1))}"', html)
html = re.sub(r'<link rel="stylesheet" href="styles\.css(?:\?[^"]*)?">', lambda _: f'<style>\n{css}\n</style>', html)

def embed_script(match):
    source = (root / match.group(1).split("?")[0]).read_text().replace('</script', '<\\/script')
    return f'<script>\n{source}\n</script>'

html = re.sub(r'<script src="([^"]+)"></script>', embed_script, html)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(html)
print(f"Standalone HTML: {target}")
