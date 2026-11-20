import createCaptureHandlers from "./handlers.mjs";

export default function captureOutput(options) {
  return createCaptureHandlers(options);
}
