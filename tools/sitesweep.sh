#!/bin/sh
# EVERY SUITE THAT GUARDS THE SITE AROUND THE GAMES, ONE AT A TIME.
#
# tools/sweep.sh is the night shift. This is the rest of the house: the
# way in, the book, the hub, the four chapters, and the two questions
# he asks about a phone -- is every control there and reachable, and
# does anything block.
#
# One browser at a time on purpose: two at once is how the container
# ran out of memory and took a render with it.
OUT=${1:-/tmp/sitesweep.log}
: > "$OUT"
for t in regress buttons landscape gate gatefit bookfit sofit apocfit \
         sidebyside landplay cardfit newplayer revisit; do
  printf '%s ... ' "$t" >> "$OUT"
  r=$(timeout 1200 node "tools/$t.js" 2>&1 | tail -40)
  line=$(printf '%s' "$r" | grep -E "passed|checks passed|no page errors" | tail -1)
  fails=$(printf '%s' "$r" | grep -cE "^ *FAIL|✗")
  if [ -z "$line" ]; then line="NO RESULT: $(printf '%s' "$r" | tail -3 | tr '\n' ' ')"; fi
  printf '%s   (FAIL lines: %s)\n' "$line" "$fails" >> "$OUT"
  printf '%s' "$r" | grep -E "^ *FAIL" | head -6 >> "$OUT"
done
printf 'smooth (sideways) ... ' >> "$OUT"
r=$(timeout 1200 node tools/smooth.js landscape 2>&1 | tail -30)
printf '%s\n' "$(printf '%s' "$r" | grep -E 'passed' | tail -1)" >> "$OUT"
printf '%s' "$r" | grep -E "^FAIL" | head -6 >> "$OUT"
echo "SITE SWEEP DONE" >> "$OUT"
