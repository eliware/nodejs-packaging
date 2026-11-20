import writeCatalogMetadata from "./catalog.mjs";
import writeValidationRecord from "./records/validation.mjs";
import writeReleaseRecord from "./records/release.mjs";
import writeProvenanceRecord from "./records/provenance.mjs";

export default async function writeReleaseRecords(input) {
  const { candidate, root, version, generationId, rpmRecordUpdated, sourceInput, now } = input;
  const generated = now.toISOString();
  const recordInput = {
    candidate,
    generationId,
    version,
    sourceInput,
    rpmRecordUpdated,
    generated,
  };
  await writeValidationRecord(recordInput);
  const releaseRecord = await writeReleaseRecord(recordInput);
  await writeProvenanceRecord(recordInput);
  await writeCatalogMetadata({ candidate, root, generationId, generated, releaseRecord });
}
