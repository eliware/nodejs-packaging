import logCapturedOutput from "../captured-output.mjs";
import handleCaptureError from "./error-handler.mjs";
import formatExitDetail from "../exit-detail.mjs";
import createStreamOutput from "../stream-output.mjs";

export default function createCaptureHandlers(options = {}) {
  const environment = options.env || process.env;
  return {
    ...createStreamOutput(options),
    onError: (error) => handleCaptureError(error, options, environment),
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
