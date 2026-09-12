#!/usr/bin/env bash
# GIVE ANWAR A VOICE, ON ANY MACHINE WITH AN OPEN INTERNET CONNECTION.
#
# The same thing .github/workflows/voice.yml does, for when you would
# rather run it yourself than click a button. Needs python3, node and
# ffmpeg, and about 300MB of disk for the engine.
#
#   bash tools/makevoice.sh                          the narrator voice
#   bash tools/makevoice.sh en_US-ryan-high 1.10     something else
#
# Renders every line he says into voice/<id>.mp3 and writes the
# manifest. Run it again with a different voice to replace the lot.
set -euo pipefail
cd "$(dirname "$0")/.."

VOICE="${1:-en_GB-alan-medium}"
PACE="${2:-1.14}"
VAR="${3:-0.72}"

command -v ffmpeg >/dev/null || { echo "ffmpeg is not installed"; exit 1; }
command -v node   >/dev/null || { echo "node is not installed"; exit 1; }

echo "--- the engine"
[ -d .voicebuild ] || python3 -m venv .voicebuild
.voicebuild/bin/pip install -q --upgrade pip
.voicebuild/bin/pip install -q piper-tts

echo "--- the voice: $VOICE"
.voicebuild/bin/python -m piper.download_voices "$VOICE" --data-dir .voicebuild/voices

echo "--- what he has to say"
node tools/voicesheet.js --json > .voicebuild/lines.json

echo "--- saying it"
mkdir -p voice
VOICE="$VOICE" PACE="$PACE" VAR="$VAR" .voicebuild/bin/python - <<'PY'
import json, os, subprocess, sys
lines = json.load(open('.voicebuild/lines.json'))
model = os.path.join('.voicebuild/voices', os.environ['VOICE'] + '.onnx')
ok = 0
for lid, text in sorted(lines.items()):
    raw = '/tmp/ns-' + lid + '.wav'
    p = subprocess.run([sys.executable, '-m', 'piper', '-m', model, '-f', raw,
                        '--length-scale', os.environ['PACE'],
                        '--noise-scale', os.environ['VAR'],
                        '--noise-w', '0.85', '--sentence-silence', '0.55'],
                       input=text.encode('utf-8'), capture_output=True)
    if p.returncode or not os.path.exists(raw):
        print('FAILED', lid, p.stderr.decode()[-300:]); continue
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af',
        'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,'
        'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1,areverse,'
        'adelay=180:all=1,apad=pad_dur=0.35,loudnorm=I=-18:TP=-2:LRA=9',
        '-ac', '1', '-ar', '24000', '-b:a', '64k',
        os.path.join('voice', lid + '.mp3')], check=True)
    os.remove(raw)
    ok += 1
    if ok % 20 == 0: print(' ', ok, 'done')
print('rendered', ok, 'of', len(lines))
PY

node tools/voicesheet.js --json > voice/manifest.json
rm -f voice/manifest.example.json
echo "--- done. $(du -sh voice | cut -f1) in voice/"
echo "Play the chapter: he is speaking now."
