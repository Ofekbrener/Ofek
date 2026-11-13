#!/usr/bin/env bash
# Copy the web game into the Android project's assets and vendor three.js, so the APK runs offline.
set -euo pipefail
GAME="$(cd "$(dirname "$0")/.." && pwd)"
WWW="$GAME/android/app/src/main/assets/www"
rm -rf "$WWW"; mkdir -p "$WWW/vendor"
cp "$GAME/index.html" "$WWW/"; cp -r "$GAME/js" "$GAME/assets" "$WWW/"
TMP="$(mktemp -d)"; (cd "$TMP" && npm pack three@0.128.0 --silent >/dev/null && tar xzf three-0.128.0.tgz)
cp "$TMP/package/build/three.min.js" "$TMP/package/examples/js/loaders/GLTFLoader.js" "$TMP/package/examples/js/utils/SkeletonUtils.js" "$WWW/vendor/"
rm -rf "$TMP"
sed -i -e 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#vendor/three.min.js#' \
       -e 's#https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js#vendor/GLTFLoader.js#' \
       -e 's#https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js#vendor/SkeletonUtils.js#' "$WWW/index.html"
grep -q 'vendor/three.min.js' "$WWW/index.html"
echo "assets ready: $(du -sh "$WWW" | cut -f1)"
