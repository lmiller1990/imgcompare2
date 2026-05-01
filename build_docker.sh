docker buildx build --load --platform linux/amd64 -t lachlanmillerdev/imgcompare-frontend -f ./packages/app/Dockerfile .
docker buildx build --load --platform linux/amd64 -t lachlanmillerdev/imgcompare-server -f ./packages/server/Dockerfile .
docker buildx build --load --platform linux/amd64 -t lachlanmillerdev/imgcompare-nginx -f ./nginx/Dockerfile ./nginx

docker push lachlanmillerdev/imgcompare-frontend
docker push lachlanmillerdev/imgcompare-server
docker push lachlanmillerdev/imgcompare-nginx
