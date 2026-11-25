"""Genera version.json: la lista de archivos de la app con su huella (sha256) y su peso.
Ejecutar antes de cada publicación:  python3 tools/make-version.py"""
import gzip, hashlib, json, pathlib, datetime
ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ['index.html', 'legal.html', 'styles.css', 'overrides.css', 'guidance.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png']
files = {}
for name in FILES:
    data = (ROOT / name).read_bytes()
    # «download» es lo que se baja por la red (los textos viajan comprimidos), para avisar el peso real.
    download = len(data) if name.endswith('.png') else len(gzip.compress(data, 6))
    files['./' + name] = {'hash': hashlib.sha256(data).hexdigest(), 'size': len(data), 'download': download}
combined = hashlib.sha256(''.join(f['hash'] for f in files.values()).encode()).hexdigest()[:12]
label = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-6))).strftime('%d/%m/%Y %H:%M')
(ROOT / 'version.json').write_text(json.dumps({'id': combined, 'label': label, 'files': files}, indent=1) + '\n')
print(combined, label, sum(f['download'] for f in files.values()), 'bytes en total')
