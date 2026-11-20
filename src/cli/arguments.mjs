export default function parseArguments(argv, booleanOptions = []) {
  const flags = new Set(booleanOptions);
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    const name = argv[index].slice(2);
    if (flags.has(name)) args.set(name, true);
    else args.set(name, argv[++index]);
  }
  return args;
}
