export default function parseImageArguments(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) {
      const name = argv[index].slice(2);
      if (name === "push") args.set(name, true);
      else args.set(name, argv[++index]);
    }
  }
  return args;
}
