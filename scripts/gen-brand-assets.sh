#!/usr/bin/env bash
# Regenerates every brand asset from the single checked-in source
# (assets/brand/open-artifacts-logo.png, 1024x1024: the swirl ring with the "A", the
# "OPEN-ARTIFACTS PROJECT" wordmark on a flat sand ground). Requires ImageMagick 7 (`magick`).
# Re-run this whenever the source artwork changes instead of hand-editing outputs.
#
# Outputs land in apps/web/public and apps/landing/public. Two tone sets of the mark exist, picked
# per theme by the --oa-logo-mark / --oa-logo-lockup tokens (packages/shared/src/design/tokens.css):
#   light  the artwork as drawn (dark moss strokes on a light page)
#   dark   same shapes recoloured to light moss (the dark strokes would vanish on the dark page)
# Favicon and touch icon use the mark on a dark-moss plate: they live on backgrounds we do not control.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="assets/brand/open-artifacts-logo.png"
BG="#E0CDAC"                          # the source's sand ground
SPARKLE="rectangle 860,880 990,990"   # a generator watermark in the bottom-right corner: painted out
WORD_TOP=790                          # y where the wordmark starts in the source (the mark ends above it)
PLATE="#2c3d1c"                       # --oa-field in the dark theme: the icon plate
DARK_FG="#e8e9e1"                     # --oa-fg in the dark theme: the dark wordmark
WEB="apps/web/public"
LANDING="apps/landing/public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$WEB/brand" "$LANDING/brand"

# --- 1. Key the sand ground out ---------------------------------------------------------------
# A global colour key (not a flood fill): the ground is enclosed inside the ring and the "A", so a
# fill from the corners would never reach it. 4% keeps the palest swirl (about 6.5% away from the
# ground) and drops the ground and its slight gradient. The 1px choke removes the light fringe that
# anti-aliased edges would otherwise leave on dark backgrounds.
magick "$SRC" -fill "$BG" -draw "$SPARKLE" \
  -alpha set -fuzz 4% -transparent "$BG" \
  -channel A -morphology Erode Disk:1 +channel \
  "$TMP/cutout.png"

magick "$TMP/cutout.png" -crop "1024x${WORD_TOP}+0+0" +repage -trim +repage "$TMP/mark-light.png"
magick "$TMP/cutout.png" -trim +repage "$TMP/lockup-light.png"

# --- 2. Dark-theme tones --------------------------------------------------------------------------
# Luminance -> light-moss ramp (the artwork has three greens: dark, mid, pale). Alpha is carried over.
magick xc:'#8fae63' xc:'#a9c47f' xc:'#c8d9ab' xc:'#e6efd6' xc:'#f3f8ea' +append \
  -filter triangle -resize 256x1! "$TMP/clut-dark.png"
darken() { # in out : recolour to the dark-theme ramp, keep alpha
  magick "$1" -alpha off -colorspace Gray "$TMP/clut-dark.png" -clut -colorspace sRGB \
    \( "$1" -alpha extract \) -alpha off -compose CopyOpacity -composite -type TrueColorAlpha "$2"
}
darken "$TMP/mark-light.png" "$TMP/mark-dark.png"
darken "$TMP/lockup-light.png" "$TMP/lockup-dark-tones.png"

# --- 3. Lockups (mark + wordmark) -------------------------------------------------------------------
LW=$(magick identify -format "%w" "$TMP/lockup-light.png")
LH=$(magick identify -format "%h" "$TMP/lockup-light.png")
MARK_H=$(magick identify -format "%h" "$TMP/mark-light.png")
BAND_Y=$(( MARK_H + 4 ))   # the wordmark band starts just below the mark (both trimmed from the same origin)
BAND_H=$(( LH - BAND_Y ))

magick "$TMP/lockup-light.png" -bordercolor none -border 24x12 -filter Lanczos -resize 560x \
  -strip -define png:compression-level=9 "$WEB/brand/logo-lockup.png"

magick "$TMP/lockup-dark-tones.png" \
  \( -clone 0 -crop "${LW}x${BAND_H}+0+${BAND_Y}" +repage -alpha extract -background "$DARK_FG" -alpha shape \) \
  -geometry "+0+${BAND_Y}" -compose over -composite "$TMP/lockup-dark.png"
magick "$TMP/lockup-dark.png" -bordercolor none -border 24x12 -filter Lanczos -resize 560x \
  -strip -define png:compression-level=9 "$WEB/brand/logo-lockup-dark.png"

# --- 4. Marks used inline (header, sidebar, viewer panel) ------------------------------------------------
square() { # in out size padding%
  magick "$1" -background none -gravity center \
    -resize "$(( $3 * (100 - 2 * $4) / 100 ))x$(( $3 * (100 - 2 * $4) / 100 ))" \
    -extent "${3}x${3}" "$2"
}
square "$TMP/mark-light.png" "$TMP/m-light.png" 192 3
square "$TMP/mark-dark.png"  "$TMP/m-dark.png"  192 3
magick "$TMP/m-light.png" -filter Lanczos -strip -define png:compression-level=9 "$WEB/brand/logo-mark.png"
magick "$TMP/m-dark.png"  -filter Lanczos -strip -define png:compression-level=9 "$WEB/brand/logo-mark-dark.png"

# --- 5. Favicon and touch icon: the dark-theme mark on a dark-moss plate -------------------------------
plate() { # size radius out
  local s=$1 r=$2 out=$3 inner=$(( $1 * 72 / 100 ))
  if [ "$r" -eq 0 ]; then
    magick -size "${s}x${s}" xc:"$PLATE" "$TMP/plate-bg.png"   # a zero-radius roundrectangle draws nothing
  else
    magick -size "${s}x${s}" xc:none -fill "$PLATE" -draw "roundrectangle 0,0 $((s-1)),$((s-1)) $r,$r" "$TMP/plate-bg.png"
  fi
  magick "$TMP/mark-dark.png" -background none -gravity center -resize "${inner}x${inner}" -extent "${s}x${s}" "$TMP/plate-mark.png"
  magick "$TMP/plate-bg.png" "$TMP/plate-mark.png" -compose over -composite "$out"
}
plate 256 36 "$TMP/fav-256.png"
magick "$TMP/fav-256.png" -colorspace sRGB -type TrueColorAlpha -filter Lanczos -define icon:auto-resize=48,32,16 "$WEB/favicon.ico"
# iOS rounds the corners itself and composites transparency onto black, so the touch icon is a full-bleed square.
plate 180 0 "$TMP/touch.png"
magick "$TMP/touch.png" -background "$PLATE" -alpha remove -alpha off -colorspace sRGB -type TrueColor -strip -define png:compression-level=9 "$WEB/apple-touch-icon.png"

# --- 6. The landing carries its own copies -------------------------------------------------------------
cp "$WEB/brand/logo-mark.png" "$WEB/brand/logo-mark-dark.png" "$LANDING/brand/"
cp "$WEB/favicon.ico" "$LANDING/favicon.ico"
cp "$WEB/apple-touch-icon.png" "$LANDING/apple-touch-icon.png"

# Mark for the social preview card (rendered separately, on the dark card)
magick "$TMP/mark-dark.png" -filter Lanczos -resize 256x256 "$TMP/og-mark.png" && cp "$TMP/og-mark.png" "assets/brand/og-mark.png"

echo "Generated:"
for f in "$WEB/brand/logo-lockup.png" "$WEB/brand/logo-lockup-dark.png" "$WEB/brand/logo-mark.png" \
         "$WEB/brand/logo-mark-dark.png" "$WEB/favicon.ico" "$WEB/apple-touch-icon.png" \
         "$LANDING/brand/logo-mark.png" "$LANDING/brand/logo-mark-dark.png" "$LANDING/favicon.ico" \
         "$LANDING/apple-touch-icon.png" assets/brand/og-mark.png; do
  echo "  $f"
done
