const args = process.argv.slice(2);

const cleanArgs = args[0] === "--" ? args.slice(1) : args;
