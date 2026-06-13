#!/usr/bin/env python3
import json
import os
import re
import urllib.request

RELEASES_JSON = "/tmp/releases.json"
OUT_DIR = "/workspace/releases"
SUMMARY_FILE = "/workspace/releases/analysis_summary.txt"
os.makedirs(OUT_DIR, exist_ok=True)

def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)

def analyze_file(path, ext):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    lines = content.count("\n") + 1
    chars = len(content)

    info = {
        "lines": lines,
        "chars": chars,
        "title": "",
        "version_string": "",
        "description": "",
        "format": ext,
        "has_webgl": False,
        "has_shader": False,
        "has_server": False,
        "html_embedded_base64": False,
        "script_blocks": 0,
        "shader_lines": 0,
        "functions_count": 0,
        "features": [],
        "key_strings": [],
    }

    m = re.search(r"<title>([^<]*)</title>", content)
    if m:
        info["title"] = m.group(1)

    for pat in [r"Material Map Generator[^\n]*", r"v\d+\.\d+[^\n\"'<]*"]:
        found = re.findall(pat, content)
        if found:
            info["version_string"] = found[0].strip()
            break

    m = re.search(r'<meta name="description" content="([^"]+)"', content)
    if m:
        info["description"] = m.group(1)

    if "WebGL" in content or "webgl" in content or "#version 300 es" in content:
        info["has_webgl"] = True
    if 'type="x-shader' in content or "GLSL" in content or "fragColor" in content:
        info["has_shader"] = True

    if "require('http')" in content or ("Material Map Generator v" in content and "Local Server" in content):
        info["has_server"] = True
    if "HTML_DATA_START" in content or "==HTML_DATA_START==" in content:
        info["html_embedded_base64"] = True

    info["script_blocks"] = len(re.findall(r"<script[^>]*>", content))

    shader_matches = re.findall(r'<script[^>]*type="x-shader[^>]*>(.*?)</script>', content, re.DOTALL)
    if shader_matches:
        info["shader_lines"] = sum(s.count("\n") + 1 for s in shader_matches)

    info["functions_count"] = len(re.findall(r"\bfunction\s+\w+\s*\(", content)) + \
                               len(re.findall(r"\bconst\s+\w+\s*=\s*(?:async\s*)?\(", content))

    feature_keywords = [
        "noise", "fbm", "tectonic", "plate", "biome", "erosion", "river",
        "contour", "moisture", "temperature", "snow", "mountain",
        "coast", "ridge", "jagged", "gzip", "localStorage",
        "WebGL2", "shader", "canvas", "i18n",
        "Material Design", "procedural", "download", "export",
        "PNG", "JPEG", "child_process", "execSync", "Material Map",
        "plateCount", "landmass", "noiseType",
    ]
    for kw in feature_keywords:
        if kw.lower() in content.lower():
            info["features"].append(kw)

    key_strings = re.findall(r"<h1[^>]*>([^<]+)</h1>", content)[:2]
    key_strings += re.findall(r'id="btn-([^"]+)"', content)[:5]
    key_strings += re.findall(r"data-i18n=\"([^\"]+)\"", content)[:5]
    info["key_strings"] = list(dict.fromkeys(key_strings))

    return info

def main():
    with open(RELEASES_JSON) as f:
        releases = json.load(f)

    def ver_key(tag):
        parts = re.findall(r"\d+", tag)
        return tuple(int(p) for p in parts) + (0,)

    releases_sorted = sorted(releases, key=lambda r: ver_key(r["tag_name"]))

    all_results = []

    for r in releases_sorted:
        tag = r["tag_name"]
        for a in r["assets"]:
            name = a["name"]
            url = a["browser_download_url"]
            size = a["size"]
            ext = os.path.splitext(name)[1].lstrip(".")
            dest = os.path.join(OUT_DIR, name)

            if not os.path.exists(dest) or os.path.getsize(dest) != size:
                try:
                    actual = download(url, dest)
                    if actual != size:
                        print(f"[WARN] {name}: size mismatch {actual} vs {size}")
                except Exception as e:
                    print(f"[ERR] {name}: download failed: {e}")
                    continue

            info = analyze_file(dest, ext)
            info["tag"] = tag
            info["file"] = name
            info["size_bytes"] = size
            info["url"] = url

            all_results.append(info)

            try:
                os.remove(dest)
            except:
                pass

            print(f"[OK] {tag} | {name} | {size:,} B | {info['lines']:,} lines")

    with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
        f.write("=" * 110 + "\n")
        f.write(" MAPGEN RELEASES - FULL ANALYSIS SUMMARY\n")
        f.write(f" Total releases analyzed: {len(all_results)}\n")
        f.write("=" * 110 + "\n\n")

        f.write("--- PER-RELEASE DETAIL ---\n")
        f.write(f"{'TAG':<25} {'FILE':<45} {'SIZE':>10} {'LINES':>8} {'FORMAT':>6} {'VERSION':<40}\n")
        f.write("-" * 170 + "\n")
        for info in all_results:
            f.write(f"{info['tag']:<25} {info['file']:<45} {info['size_bytes']:>10,} {info['lines']:>8,} {info['format']:>6} {info['version_string'][:40]:<40}\n")

        f.write("\n\n--- FEATURE MATRIX ---\n")
        f.write(f"{'TAG':<22} {'TITLE':<35} {'FMT':>4} {'WGL':>4} {'SHD':>4} {'SRV':>4} {'B64':>4} {'FUNCS':>6} {'LINES':>7} {'FEATURES'}\n")
        f.write("-" * 200 + "\n")
        for info in all_results:
            feat_short = ", ".join(info["features"][:8])
            title_s = (info["title"] or info["description"])[:35]
            f.write(f"{info['tag']:<22} {title_s:<35} {info['format']:>4} "
                    f"{'y' if info['has_webgl'] else '-':>4} "
                    f"{'y' if info['has_shader'] else '-':>4} "
                    f"{'y' if info['has_server'] else '-':>4} "
                    f"{'y' if info['html_embedded_base64'] else '-':>4} "
                    f"{info['functions_count']:>6,} {info['lines']:>7,} {feat_short}\n")

        f.write("\n\n--- EVOLUTION: FILE SIZE GROWTH ---\n")
        for info in all_results:
            bar_len = int(info["size_bytes"] / 1500)
            f.write(f"{info['tag']:<25} {info['size_bytes']:>8,} B {'█' * bar_len}\n")

        f.write("\n\n--- FORMAT EVOLUTION ---\n")
        for info in all_results:
            f.write(f"{info['tag']:<25} -> {info['format'].upper()} ({info['lines']:,} lines, {info['size_bytes']:,} bytes)\n")

        f.write("\n\n--- PER-RELEASE KEY FINDINGS ---\n\n")
        for info in all_results:
            f.write(f"【{info['tag']}】 {info['file']}\n")
            f.write(f"  Title: {info['title']}\n")
            f.write(f"  Version string: {info['version_string']}\n")
            f.write(f"  Description: {info['description']}\n")
            f.write(f"  Format: {info['format']} | Size: {info['size_bytes']:,} B | Lines: {info['lines']:,}\n")
            f.write(f"  Script blocks: {info['script_blocks']} | Function defs: {info['functions_count']} | Shader lines: {info['shader_lines']}\n")
            f.write(f"  WebGL: {'YES' if info['has_webgl'] else 'no'} | Shaders: {'YES' if info['has_shader'] else 'no'} | Node server: {'YES' if info['has_server'] else 'no'} | Base64 embed: {'YES' if info['html_embedded_base64'] else 'no'}\n")
            if info["features"]:
                f.write(f"  Features: {', '.join(info['features'])}\n")
            if info["key_strings"]:
                f.write(f"  UI strings: {', '.join(info['key_strings'][:8])}\n")
            f.write(f"  URL: {info['url']}\n\n")

    print(f"\n=== SUMMARY WRITTEN TO {SUMMARY_FILE} ===")
    print(f"Total releases analyzed: {len(all_results)}")

if __name__ == "__main__":
    main()
