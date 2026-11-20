import logCapturedOutput from "../captured-output.mjs";

export default function handleCaptureError(error, options, environment) {
  return options.logPath
    ? logCapturedOutput({
        file: options.logPath,
        name: options.logName,
        stderr: error.message,
        env: environment,
        quiet: true,
      })
    : undefined;
}
