export default function formatExitDetail(code, stderr) {
  return code === 0 ? "" : `: ${stderr}`;
}
