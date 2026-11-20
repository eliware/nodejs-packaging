import commitAndPushRepository from "./repository-git/commit-push.mjs";
import repositoryGitSettings from "./repository-git/settings.mjs";
import loadActiveGeneration from "./repository-git/active-generation.mjs";

export default async function main(env) {
  const settings = repositoryGitSettings(env);
  const generation = await loadActiveGeneration(settings.repositoryRoot);
  commitAndPushRepository({ ...settings, generation });
}
