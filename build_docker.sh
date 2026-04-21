docker buildx build --load -t lachlanmillerdev/imgcompare-frontend -f ./packages/app/Dockerfile .
docker buildx build --load -t lachlanmillerdev/imgcompare-server -f ./packages/server/Dockerfile .
