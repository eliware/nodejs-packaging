import path from "node:path";

function createMemoryFs() {
  const entries = new Map([[path.resolve("/"), { type: "directory" }]]);
  let sequence = 0;

  function normalize(file) {
    return path.resolve(String(file));
  }

  function resolveLink(file) {
    let normalized = normalize(file);
    const entry = entries.get(normalized);
    if (entry?.type === "symlink")
      return normalize(path.resolve(path.dirname(normalized), entry.target));
    let parent = path.dirname(normalized);
    while (parent !== normalized) {
      const parentEntry = entries.get(parent);
      if (parentEntry?.type === "symlink") {
        const resolvedParent = normalize(path.resolve(path.dirname(parent), parentEntry.target));
        return path.join(resolvedParent, path.relative(parent, normalized));
      }
      normalized = parent;
      parent = path.dirname(parent);
    }
    return normalize(file);
  }

  function ensureDirectory(file) {
    const normalized = normalize(file);
    if (!entries.has(normalized)) entries.set(normalized, { type: "directory" });
    return normalized;
  }

  function statValue(entry) {
    return {
      size: entry.type === "file" ? Buffer.byteLength(entry.content) : 0,
      mtime: new Date("2026-01-01T00:00:00.000Z"),
      isDirectory: () => entry.type === "directory",
      isFile: () => entry.type === "file",
      isSymbolicLink: () => entry.type === "symlink",
    };
  }

  async function mkdir(file, options = {}) {
    const normalized = normalize(file);
    const existing = entries.get(normalized);
    if (existing) {
      if (options.recursive) return normalized;
      throw Object.assign(new Error("path exists"), { code: "EEXIST" });
    }
    if (options.recursive) {
      let current = path.parse(normalized).root;
      for (const part of normalized.slice(current.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        ensureDirectory(current);
      }
    } else {
      const parent = entries.get(path.dirname(normalized));
      if (!parent || parent.type !== "directory")
        throw Object.assign(new Error("missing parent"), { code: "ENOENT" });
      ensureDirectory(normalized);
    }
    return normalized;
  }

  async function writeFile(file, content) {
    const normalized = normalize(file);
    const parent = entries.get(path.dirname(normalized));
    if (!parent || parent.type !== "directory")
      throw Object.assign(new Error("missing parent"), { code: "ENOENT" });
    entries.set(normalized, {
      type: "file",
      content: Buffer.isBuffer(content) ? content : String(content),
    });
  }

  function writeFileSync(file, content) {
    const normalized = normalize(file);
    const parent = entries.get(path.dirname(normalized));
    if (!parent || parent.type !== "directory")
      throw Object.assign(new Error("missing parent"), { code: "ENOENT" });
    entries.set(normalized, {
      type: "file",
      content: Buffer.isBuffer(content) ? content : String(content),
    });
  }

  function mkdirSync(file, options = {}) {
    const normalized = normalize(file);
    if (entries.has(normalized)) return;
    if (options.recursive) {
      let current = path.parse(normalized).root;
      for (const part of normalized.slice(current.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        ensureDirectory(current);
      }
      return normalized;
    }
    const parent = entries.get(path.dirname(normalized));
    if (!parent || parent.type !== "directory")
      throw Object.assign(new Error("missing parent"), { code: "ENOENT" });
    ensureDirectory(normalized);
  }

  async function readFile(file, options) {
    const normalized = resolveLink(file);
    const entry = entries.get(normalized);
    if (!entry || entry.type !== "file")
      throw Object.assign(new Error("file missing"), { code: "ENOENT" });
    const content = Buffer.from(entry.content);
    return typeof options === "string" || options?.encoding
      ? content.toString(typeof options === "string" ? options : options.encoding)
      : content;
  }

  async function stat(file) {
    const normalized = resolveLink(file);
    const entry = entries.get(normalized);
    if (!entry) throw Object.assign(new Error("path missing"), { code: "ENOENT" });
    return statValue(entry);
  }

  async function lstat(file) {
    const entry = entries.get(normalize(file));
    if (!entry) throw Object.assign(new Error("path missing"), { code: "ENOENT" });
    return statValue(entry);
  }

  async function readdir(file, options = {}) {
    const normalized = resolveLink(file);
    const entry = entries.get(normalized);
    if (!entry || entry.type !== "directory")
      throw Object.assign(new Error("directory missing"), { code: "ENOENT" });
    const children = new Map();
    for (const [candidate, value] of entries) {
      if (candidate === normalized || !candidate.startsWith(`${normalized}${path.sep}`)) continue;
      const relative = candidate.slice(normalized.length + 1);
      if (!relative || relative.includes(path.sep)) continue;
      children.set(relative, value);
    }
    return [...children].map(([name, child]) =>
      options.withFileTypes
        ? {
            name,
            isDirectory: () => child.type === "directory",
            isFile: () => child.type === "file",
          }
        : name,
    );
  }

  async function rm(file, options = {}) {
    const normalized = normalize(file);
    const keys = [...entries.keys()].filter(
      (candidate) => candidate === normalized || candidate.startsWith(`${normalized}${path.sep}`),
    );
    if (!keys.length && !options.force)
      throw Object.assign(new Error("path missing"), { code: "ENOENT" });
    if (!options.recursive && keys.length > 1)
      throw Object.assign(new Error("directory not empty"), { code: "ENOTEMPTY" });
    for (const key of keys) entries.delete(key);
  }

  async function cp(source, destination) {
    const from = resolveLink(source);
    const to = normalize(destination);
    const entry = entries.get(from);
    if (!entry) throw Object.assign(new Error("source missing"), { code: "ENOENT" });
    if (entry.type === "file") return writeFile(to, entry.content);
    ensureDirectory(to);
    for (const child of [...entries.keys()].filter((candidate) =>
      candidate.startsWith(`${from}${path.sep}`),
    )) {
      const target = path.join(to, path.relative(from, child));
      const childEntry = entries.get(child);
      if (childEntry.type === "directory") ensureDirectory(target);
      else if (childEntry.type === "file") await writeFile(target, childEntry.content);
    }
  }

  async function rename(source, destination) {
    const from = normalize(source);
    const to = normalize(destination);
    const moving = [...entries].filter(
      ([candidate]) => candidate === from || candidate.startsWith(`${from}${path.sep}`),
    );
    if (!moving.length) throw Object.assign(new Error("source missing"), { code: "ENOENT" });
    for (const [candidate] of moving) entries.delete(candidate);
    for (const [candidate, entry] of moving)
      entries.set(path.join(to, path.relative(from, candidate)), entry);
  }

  async function symlink(target, file) {
    entries.set(normalize(file), { type: "symlink", target });
  }

  async function mkdtemp(prefix) {
    const directory = `${normalize(prefix)}${sequence++}`;
    await mkdir(directory, { recursive: true });
    return directory;
  }

  return {
    mkdir,
    mkdirSync,
    writeFile,
    writeFileSync,
    readFile,
    stat,
    lstat,
    readdir,
    rm,
    cp,
    rename,
    symlink,
    mkdtemp,
  };
}

export default function memoryFilesystemFixture() {
  return { createMemoryFs };
}
