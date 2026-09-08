#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer currently supports Debian/Ubuntu/WSL2 only." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  git autoconf automake libtool pkg-config build-essential gcc \
  libxml2-dev libpcre2-dev librsvg2-bin ca-certificates curl

WORKDIR="${LIBREDWG_BUILD_DIR:-$HOME/.cache/jsolution-libredwg}"
PREFIX="${LIBREDWG_PREFIX:-/usr/local}"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

if [ -d libredwg/.git ]; then
  git -C libredwg fetch --depth 1 origin master
  git -C libredwg reset --hard origin/master
else
  rm -rf libredwg
  git clone --depth 1 https://github.com/LibreDWG/libredwg.git
fi

cd libredwg
sh ./autogen.sh
./configure --disable-bindings --disable-docs --enable-release --prefix="$PREFIX"
make -j"$(nproc)"
sudo make install
sudo ldconfig

printf '\nLibreDWG installed.\n'
dwg2SVG --version || true
dwg2dxf --version || true
rsvg-convert --version || true
printf '\nNext: npm run dwg:converter\n'
