export default function resolveRepositoryUrl(env = process.env) {
  return env.NODEJS_REPOSITORY_URL || "https://nodejs.eliware.org";
}
