import type { ProjectsForUser } from "@packages/server/src/db/projects";
import { useKy } from "./composables/ky";

export async function getProjects(): Promise<ProjectsForUser> {
  const ky = useKy();
  const res = await ky.get<{ projects: ProjectsForUser }>("/api/me");
  return res.json();
}
