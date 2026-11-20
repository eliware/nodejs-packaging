export default function createStreamOutput(options = {}) {
  return {
    onStdout: (chunk) => {
      if (!options.quiet && !options.logPath) process.stdout.write(chunk);
    },
    onStderr: (chunk) => {
      if (!options.quiet && !options.logPath) process.stderr.write(chunk);
    },
  };
}
