# server

## Project setup

Before start, you need to install nodejs and npm.
Then, install dependencies and build project.

```sh
npm install
npm run build
```

Install pm2 globally

```sh
npm install pm2 -g
```

Start server

```sh
pm2 start dist/server.js --name server-api -i 3
```

Stop server

```sh
pm2 startup
pm2 save
```
