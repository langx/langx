#!/bin/zsh
# Incremental upload while a render batch runs: one `upload.mjs media` pass every ~10 min, then a
# last pass after the batch exits. upload.mjs only takes a video whose mp4 and cover have both sat
# unchanged for 3 minutes and probe clean, so a file still being written is picked up next time.
#
#   ./sync-loop.sh        start it after `node batch.mjs ...`; logs go to out/upload.log
#
# Error output is kept in out/upload-errors.log with anything that looks like a credential
# filtered out first.
cd "${0:A:h}" || exit 1
mkdir -p out
pass() {
  local out; out=$(node upload.mjs media 2>&1); local rc=$?
  [ $rc -ne 0 ] && { echo "== $(date '+%F %T')"; echo "$out" | grep -v '^[0-9]*/[0-9]* {' | grep -viE 'credential|authorization|signature|secret|access.?key|x-amz' | tail -40; } >> out/upload-errors.log
  echo "$(date '+%F %T') [$1] rc=$rc $(echo "$out" | grep '^media:' || echo "$out" | tail -3 | tr '\n' ' ')" >> out/upload.log
}
while pgrep -f "node batch.mjs" >/dev/null; do pass loop; sleep 600; done
pass final-after-batch
echo "$(date '+%F %T') batch exited; loop done" >> out/upload.log
