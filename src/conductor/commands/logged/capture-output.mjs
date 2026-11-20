import logCapturedOutput from "./captured-output.mjs";
import formatExitDetail from "./exit-detail.mjs";
import createStreamOutput from "./stream-output.mjs";

export default function captureOutput(options = {}) {
  const environment = options.env || process.env;
  return {
    ...createStreamOutput(options),
    onError: (error) =>
      options.logPath
        ? logCapturedOutput({
            file: options.logPath,
            name: options.logName,
            stderr: error.message,
            env: environment,
            quiet: true,
          })
        : undefined,
    onExit: async ({ code, stdout, stderr }) => {
      const safe = options.logPath
        ? await logCapturedOutput({
            file: options.logPath,
            name: options.logName,
            stdout,
            stderr,
            env: environment,
            quiet: options.quiet,
          })
        : { stdout, stderr };
      return formatExitDetail(code, safe.stderr);
    },
  };
}
