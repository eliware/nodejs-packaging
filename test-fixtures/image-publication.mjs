import path from "node:path";

export default function imagePublicationFixture(fs) {
  return async function setupImagePublication() {
    const root = "/virtual/image-repository";
    const oldRoot = path.join(root, ".generations/generation-1");
    const recordPath = "/virtual/image.json";
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(recordPath, { force: true });
    await fs.mkdir(path.join(root, "metadata"), { recursive: true });
    await fs.mkdir(path.join(oldRoot, "metadata/provenance"), { recursive: true });
    await fs.mkdir(path.join(oldRoot, "metadata/releases"), { recursive: true });
    await fs.mkdir(path.join(oldRoot, "metadata/validation"), { recursive: true });
    await fs.mkdir(path.join(oldRoot, "metadata"), { recursive: true });
    await fs.mkdir(path.join(oldRoot, "el10/x86_64/stable/repodata"), { recursive: true });
    await fs.writeFile(
      path.join(root, "metadata/active-generation.json"),
      JSON.stringify({ generation: "generation-1" }),
    );
    await fs.writeFile(
      path.join(oldRoot, "metadata/catalog.json"),
      JSON.stringify({
        stable: {
          latest: { node_version: "26.13.1" },
          items: [{ node_version: "26.13.1" }],
        },
      }),
    );
    await fs.writeFile(
      path.join(root, "metadata/catalog.json"),
      JSON.stringify({ stable: { latest: { node_version: "26.13.1" } } }),
    );
    await fs.writeFile(
      path.join(oldRoot, "metadata/release-manifest.json"),
      JSON.stringify({ generation_id: "generation-1", files: [] }),
    );
    await fs.writeFile(path.join(oldRoot, "metadata/release-manifest.json.asc"), "signature");
    await fs.writeFile(
      path.join(oldRoot, "metadata/provenance/package.json"),
      JSON.stringify({ node_version: "26.13.1" }),
    );
    await fs.writeFile(path.join(oldRoot, "metadata/provenance/package.json.asc"), "signature");
    await fs.writeFile(
      path.join(oldRoot, "metadata/releases/nodejs26.json"),
      JSON.stringify({ node_version: "26.13.1" }),
    );
    await fs.writeFile(path.join(oldRoot, "metadata/validation/package.json"), "{}");
    await fs.writeFile(path.join(oldRoot, "metadata/repository-index.json"), "{}");
    await fs.writeFile(path.join(oldRoot, "el10/x86_64/stable/repodata/repomd.xml"), "repodata");
    await fs.writeFile(
      recordPath,
      JSON.stringify({
        repository: "ghcr.io/eliware/centos10-node26",
        tag: "26.13.1",
        digest: `sha256:${"a".repeat(64)}`,
        base_image: "quay.io/centos/centos:stream10",
        base_image_digest: `quay.io/centos/centos@sha256:${"b".repeat(64)}`,
        rpm_sha256: "c".repeat(64),
        source_release: "26.13.1",
        source_sha256: "d".repeat(64),
        local_image_id: "sha256:local",
        repository_generation: "generation-1",
        published: true,
        validation: "passed",
      }),
    );
    process.env.NODEJS_REPOSITORY_ROOT = root;
    process.env.NODEJS_SIGNING_KEY = "A".repeat(40);
    delete process.env.NODEJS_GNUPGHOME;
    return { root, oldRoot, recordPath };
  };
}
