#! /usr/bin/env bash

arch=$(uname -m)

if [ "$arch" == "arm64" ]
then
    arch="silicon"
elif [ "$arch" == "x86_64" ]
then
    arch="intel"
fi

mkdir "$HOME/.local/bin"
echo "$HOME/.local/bin" >> "$GITHUB_PATH"

wget "https://core.pakket.sh/pakket-builder/$arch/pakket-builder"
install pakket-builder "$HOME/.local/bin/pakket-builder"

pakket-builder -h