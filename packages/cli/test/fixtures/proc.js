const delay = () => new Promise((res) => globalThis.setTimeout(res, 500));

async function main() {
  console.log("Running...");
  await delay();
  console.log("Done!");
}

main();
