export default function writeImagePublicationOutput({
  generationId,
  image,
  output = process.stdout,
}) {
  output.write(`${JSON.stringify({ generation: generationId, image }, null, 2)}\n`);
}
