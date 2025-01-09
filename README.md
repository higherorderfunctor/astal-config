# astal-config

Update or regenerate types.

```sh
// ags types --tsconfig

ags types 'Astal*' -d vendor/@types

pnpm patch astal
cd node_modules/.pnpm_patches/astal@*/lang/gjs
pnpm tsc --rootDir src --emitDeclarationOnly --declaration --outDir dist/dts src/**/*.ts
pnpm esbuild src/index.ts \
  --bundle \
  --tsconfig=tsconfig.json \
  --external:"gi://*" \
  --minify \
  --sourcemap \
  --format=esm \
  --outdir=dist/esm \
  --target=esnext
pnpm esbuild src/gtk3/index.ts \
  --bundle \
  --tsconfig=tsconfig.json \
  --external:"gi://*" \
  --external:"console" \
  --external:"system" \
  --minify \
  --sourcemap \
  --format=esm \
  --outfile=dist/esm/gtk3.js \
  --target=esnext
pnpm esbuild src/gtk4/index.ts \
  --bundle \
  --tsconfig=tsconfig.json \
  --external:"gi://*" \
  --external:"console" \
  --external:"system" \
  --minify \
  --sourcemap \
  --format=esm \
  --outfile=dist/esm/gtk4.js \
  --target=esnext
pnpm api-extractor run -c ../../../../../configs/api-extractor/astal.json --local

    "postinstall": "esbuild ./node_modules/package-name/src/index.ts --bundle --platform=node --format=cjs --outdir=./node_modules/package-name/dist"

```

    //"astal": "github:Aylur/astal#path:/lang/gjs",

Random commands from history last time I played with Astal.

```sh
ags quit applauncher
ags quit -i applauncher
ags run ~/.config/ags/applauncher.ts
ags toggle applauncher
ags toggle -i applauncher
ags toggle launcher
ags toggle -i launcher ags toggle
ags types Astal* --i
ags list js
ags quit
ags list
```
