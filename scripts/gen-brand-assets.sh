#!/usr/bin/env bash
# Regenerates every brand asset in apps/web/public from the single checked-in source
# (assets/brand/open-artifacts-logo.png, 1292x1292). Requires ImageMagick 7 (`magick`). Re-run
# this whenever the source artwork changes instead of hand-editing outputs.
#
# Geometry below was measured directly against the source with `magick -trim` (see the PR
# description for the measurement commands) — treat the numbers as derived facts about this
# specific file, not arbitrary constants.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="assets/brand/open-artifacts-logo.png"
BG="#F9F8EF" # the source's cream ground color
PUBLIC="apps/web/public"
BRAND="$PUBLIC/brand"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$BRAND"

# --- 1. Strip the cream ground to transparency -----------------------------------------------
# Two passes are needed: the ring is open at the top right (where the three badge icons float),
# so a flood-fill from the four outer corners leaks through that gap and also clears the interior
# — which is what we want (badges + wordmark keep flood-filling cleanly). A final global
# -transparent sweep mops up small closed cream pockets the flood-fill's connectivity missed
# (e.g. inside letterforms). fuzz 22%/6% was chosen empirically: lower leaves a visible cream
# halo on dark backgrounds; the fine decorative "network" lines inside the ring survive as a
# faint, thematically-fitting texture once everything is downsampled with a proper filter (see
# the Lanczos -resize calls below — skipping that filter is what makes this look like TV static).
strip_bg() {
  magick "$1" \
    -alpha set -fuzz 22% \
    -fill none -floodfill +0+0 "$BG" \
    -fill none -floodfill +1291+0 "$BG" \
    -fill none -floodfill +0+1291 "$BG" \
    -fill none -floodfill +1291+1291 "$BG" \
    -fuzz 6% -transparent "$BG" \
    "$2"
}

strip_bg "$SRC" "$TMP/cutout.png"

# --- 2. Full lockup (ring + badges + "OPEN-ARTIFACTS PROJECT" wordmark), light-theme variant --
# bbox measured on the opaque source: x 209..1083, y 174..1157.
magick "$TMP/cutout.png" -crop 874x983+209+174 +repage "$TMP/lockup-light.png"

# Dark-theme variant: the wordmark is a flat dark navy that disappears on the app's dark
# background (--oa-bg: #0a0a0b). Recolor only the wordmark band (the bottom ~21% of the lockup,
# a flat-colored glyph so recoloring by alpha-as-mask doesn't touch anti-aliasing) to the dark
# theme's foreground token (--oa-fg: #f4f4f5); the mark above it is multi-color and already reads
# fine on both backgrounds, so it's copied through untouched.
WORD_Y=776 # 983 * 0.79, rounded — top of the wordmark band within the lockup crop
magick "$TMP/lockup-light.png" \
  \( -clone 0 -crop 874x207+0+${WORD_Y} +repage -alpha extract -background "#f4f4f5" -alpha shape \) \
  -geometry +0+${WORD_Y} -compose over -composite \
  "$TMP/lockup-dark.png"

magick "$TMP/lockup-light.png" -filter Lanczos -resize 560x \
  -strip -define png:compression-level=9 \
  "$BRAND/logo-lockup.png"
magick "$TMP/lockup-dark.png" -filter Lanczos -resize 560x \
  -strip -define png:compression-level=9 \
  "$BRAND/logo-lockup-dark.png"

# --- 3. Monogram ring only, badges cropped out --------------------------------------------
# The three badge icons read fine in the ~280px auth-page lockup but turn to mush at the sizes
# everything else in this section needs (16-32px favicon, 20px sidebar/header mark), so those all
# share one crop with the badges erased before the flood-fill (rectangle chosen to cover all
# three badges without touching the ring's own top-right stroke, which starts lower/further left
# — verified visually).
magick "$SRC" -fill "$BG" -draw "rectangle 690,140 1100,400" "$TMP/badges-erased.png"
strip_bg "$TMP/badges-erased.png" "$TMP/ring-transparent.png"
magick "$TMP/ring-transparent.png" -crop 740x719+315+238 +repage "$TMP/ring-only.png"

# Sidebar / mobile-header mark
magick "$TMP/ring-only.png" -filter Lanczos -resize 128x128 \
  -strip -define png:compression-level=9 \
  "$BRAND/logo-mark.png"

# --- 4. Favicon -----------------------------------------------------------------------------
magick "$TMP/ring-only.png" -filter Lanczos -resize 256x256 \
  -define icon:auto-resize=48,32,16 \
  "$PUBLIC/favicon.ico"

# apple-touch-icon: iOS composites transparent PNGs onto black, so this one gets an opaque cream
# backfill instead of transparency.
magick "$TMP/ring-only.png" -filter Lanczos -resize 180x180 \
  -background "$BG" -alpha remove -alpha off \
  -strip -define png:compression-level=9 \
  "$PUBLIC/apple-touch-icon.png"

echo "Generated:"
echo "  $BRAND/logo-lockup.png"
echo "  $BRAND/logo-lockup-dark.png"
echo "  $BRAND/logo-mark.png"
echo "  $PUBLIC/favicon.ico"
echo "  $PUBLIC/apple-touch-icon.png"
