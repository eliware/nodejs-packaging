export default function parseRollbackArguments(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) {
      args.set(argv[index].slice(2), argv[index + 1]);
      index += 1;
    }
  }
  return args;
}
