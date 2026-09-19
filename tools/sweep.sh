#!/bin/sh
# EVERY SUITE THAT GUARDS THE NIGHT SHIFT, ONE AT A TIME.
#
# One browser at a time on purpose: three of these at once is how the
# container ran out of memory and took a render with it. Sequential is
# slower and it is the only way the numbers mean anything.
OUT=${1:-/tmp/sweep.log}
: > "$OUT"
for t in storycheck scriptcheck midcheck endcheck overcheck camcheck geomcheck \
         saycheck revealcheck castcheck linecheck oncecheck cuecheck nightplay; do
  printf '%s ... ' "$t" >> "$OUT"
  r=$(timeout 900 node "tools/$t.js" 2>&1 | tail -30)
  line=$(printf '%s' "$r" | grep -E "passed|checks passed|clean seams" | tail -1)
  fails=$(printf '%s' "$r" | grep -cE "^  FAIL|✗")
  if [ -z "$line" ]; then line="NO RESULT: $(printf '%s' "$r" | tail -3 | tr '\n' ' ')"; fi
  printf '%s   (FAIL lines: %s)\n' "$line" "$fails" >> "$OUT"
  printf '%s' "$r" | grep -E "^  FAIL" | head -6 >> "$OUT"
done
echo "SWEEP DONE" >> "$OUT"
