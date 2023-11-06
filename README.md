# API Server

This project is a Node.js application. Before you can run it, you need to set up your environment.

## Prerequisites

Before running the application, ensure that you have the following installed on your machine:

- Node.js
- npm

## Installation

1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Install the project dependencies by running:

```sh
npm install
```

4. Build the project by running:

```sh
npm run build
```

5. Install pm2 globally. pm2 is a production process manager for Node.js applications with a built-in load balancer. You can install it by running:

```sh
npm install pm2 -g
```

## Configuration

This project uses environment variables for configuration. These are stored in a `.env` file. A sample `.env.sample` file is provided in the repository.

To use the `.env.sample` file:

1. Copy the `.env.sample` file and rename the copy to `.env.`
2. Replace the placeholder values in the `.env` file with your actual values.

## Running the Server

After you've set up your environment, you can start the server by running:

```sh
pm2 start dist/server.js --name server-api -i 3
```

To ensure that the server restarts when the system reboots, run:

```sh
pm2 startup
pm2 save
```

## Conclusion

That's it! You've now set up and run the server. If you have any issues, please open an issue.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

Please note that this license does not cover any third-party libraries or dependencies used in this project. Those libraries and dependencies are covered by their respective licenses.
