docker buildx build --load --platform linux/amd64 -t lachlanmillerdev/imgcompare-frontend -f ./packages/app/Dockerfile .
docker buildx build --load --platform linux/amd64 -t lachlanmillerdev/imgcompare-server -f ./packages/server/Dockerfile .
