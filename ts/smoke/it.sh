set -e

tmpDir=$(mktemp -d)

projectRoot=$(pwd)

rm -rf smoke/node_modules
cp dist/pubdir/adviser-scopey-*.tgz smoke/* $tmpDir 
cd $tmpDir
#rm -f package.json pnpm-lock.yaml tsconfig.json
#pnpm init
pnpm install ./adviser-scopey-*.tgz
pnpm add tsx
pnpm add deno
# pnpm exec tsc --init
npx tsx ./smoke.ts
npx deno run --allow-read --allow-write ./smoke.ts
rm -f package.json pnpm-lock.yaml tsconfig.json

if [ -z "$NO_CLEANUP" ]
then
  rm -rf $tmpDir
else
  echo $tmpDir
fi

