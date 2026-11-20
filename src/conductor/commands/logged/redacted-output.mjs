import writeRedactedCommandOutput from "./output.mjs";

export default function createRedactedOutputHandlers(options) {
  const env = options.env || process.env;
  return {
    onStdout: () => {},
    onStderr: () => {},
    onError: async (error) => {
      await writeRedactedCommandOutput({
        file: options.logPath,
        name: options.logName,
        stderr: error.message,
        env,
      });
    },
    onExit: async ({ stdout, stderr }) => {
      const safe = await writeRedactedCommandOutput({
        file: options.logPath,
        name: options.logName,
        stdout,
        stderr,
        env,
      });
      process.stdout.write(safe.stdout);
      process.stderr.write(safe.stderr);
      return "";
    },
  };
}
