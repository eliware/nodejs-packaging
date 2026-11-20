export default function reportRollbackFailure(error, output = console) {
  output.error(error.message);
  process.exitCode = 1;
}
