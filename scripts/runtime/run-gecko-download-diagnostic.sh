#!/usr/bin/env bash
set -u

cd "${GITHUB_WORKSPACE:-$(pwd)}"
LOG="${GITHUB_WORKSPACE:-$(pwd)}/task4-gecko-runtime.log"
: > "$LOG"

APK="$(find "work/${BUILD_ID}/project/app/build/outputs/apk/debug" -name '*.apk' -type f | head -n 1)"
if [ -z "$APK" ] || [ ! -s "$APK" ]; then
  echo "[task4-diagnostic] APK missing: ${APK:-<none>}" | tee -a "$LOG"
  exit 90
fi

echo "[task4-diagnostic] APK=$APK" | tee -a "$LOG"
set +e
node scripts/runtime/gecko-controls-smoke-core.mjs "$APK" >> "$LOG" 2>&1
rc=$?
set -e

{
  echo
  echo '=== downloads-directory ==='
  adb shell 'ls -la /sdcard/Download 2>&1 || true' || true
  echo
  echo '=== download-provider my_downloads ==='
  adb shell content query --uri content://downloads/my_downloads 2>&1 || true
  echo
  echo '=== download-provider all_downloads ==='
  adb shell content query --uri content://downloads/all_downloads 2>&1 || true
  echo
  echo '=== dumpsys download ==='
  adb shell dumpsys download 2>&1 || true
  echo
  echo '=== relevant logcat ==='
  adb logcat -d 2>&1 | grep -Ei 'DownloadManager|DownloadProvider|DownloadThread|task4-download|download\.txt' | tail -300 || true
} >> "$LOG" 2>&1

cat "$LOG"
exit "$rc"
