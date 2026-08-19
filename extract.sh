#!/bin/sh
# Slice the FSRS-6 block straight out of index.html so the oracle test runs
# against the SHIPPED code, not a copy that can drift from it.
set -e
S=$(grep -n '^const FSRS_W=' index.html | cut -d: -f1)
E=$(( $(grep -n '^/\* ---- one-time migration' index.html | cut -d: -f1) - 2 ))
sed -n "${S},${E}p" index.html > /tmp/fsrs-inline.mjs
cat >> /tmp/fsrs-inline.mjs <<'X'
export {FSRS_W,FSRS_DECAY,FSRS_FACTOR,roundHalfToEven,fsrsRetrievability,fsrsInitialStability,
 fsrsInitialDifficulty,fsrsNextDifficulty,fsrsNextRecallStability,fsrsNextForgetStability,
 fsrsShortTermStability,fsrsNextInterval,fsrsNew,fsrsReview};
X
echo "sliced lines ${S}-${E} of index.html"
