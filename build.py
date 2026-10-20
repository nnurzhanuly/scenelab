"""Offline, deterministic wrapper for the pinned Three.js ES modules.

No third-party Python package or network request is used. The vendor files are
unmodified; explicit ESM export/import lists become two private IIFE namespaces.
The complete application is embedded in index.html so file:// needs no server.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent

def bindings(names):
    entries = []
    for item in names.split(','):
        pair = re.split(r'\s+as\s+', item.strip())
        if not pair[0]:
            continue
        if len(pair) > 2 or any(not re.fullmatch(r'[\w$]+', v) for v in pair):
            raise ValueError('Unexpected module binding')
        entries.append((pair[0], pair[-1]))
    return entries

def exports_object(names):
    return ','.join(f'{out}:{local}' for local, out in bindings(names))

core = (ROOT/'src/vendor/three.core.js').read_text()
core_match = re.findall(r'^export \{(.*?)\};\s*$', core, re.M)
assert len(core_match) == 1
core = re.sub(r'^export \{.*?\};\s*$', '', core, flags=re.M)
module = (ROOT/'src/vendor/three.module.js').read_text()
imports = re.findall(r"^import \{(.*?)\} from './three.core.js';", module, re.M)
assert len(imports) == 1
module = re.sub(r"^import \{.*?\} from './three.core.js';", '', module, flags=re.M)
module = re.sub(r"^export \{.*?\} from './three.core.js';", '', module, flags=re.M)
own_exports = re.findall(r'^export \{(.*?)\};\s*$', module, re.M)
assert len(own_exports) == 1
module = re.sub(r'^export \{.*?\};\s*$', '', module, flags=re.M)
import_list = ','.join(f'{original}:{local}' for original,local in bindings(imports[0]))
bundle = '(function(){\n"use strict";\nconst core=(function(){\n'+core+'\nreturn {'+exports_object(core_match[0])+'};})();\n'
bundle += 'const engine=(function(){\nconst {'+import_list+'}=core;\n'+module+'\nreturn {'+exports_object(own_exports[0])+'};})();\n'
bundle += 'globalThis.THREE=Object.assign({},core,engine);\n})();\n'
(ROOT/'src/vendor/three.bundle.js').write_text(bundle)
code = bundle+'\n'+(ROOT/'src/model.js').read_text()+'\n'+(ROOT/'src/world.js').read_text()+'\n'+(ROOT/'src/app.js').read_text()
assert '<!--APP-->' in (ROOT/'src/template.html').read_text()
code = code.replace('</script', '<\\/script')
html = (ROOT/'src/template.html').read_text().replace('<!--APP-->', '<script>\n'+code+'\n</script>')
(ROOT/'index.html').write_text(html)
print('SceneLab index.html built:', len(html.encode()), 'bytes; no external requests')
