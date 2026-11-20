export default function checksumForFile(text, fileName) {
  const matches = text
    .split(/\r?\n/)
    .map((line) => /^([a-f\d]{64})\s+\*?(.+)$/.exec(line))
    .filter((match) => match?.[2] === fileName);
  if (matches.length !== 1) throw new Error(`checksum file has no unique entry for ${fileName}`);
  return matches[0][1];
}
