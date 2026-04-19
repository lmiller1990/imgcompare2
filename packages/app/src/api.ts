import type { ProjectsForUser } from "@packages/server/src/db/projects";
import type { ProjectView } from "@packages/server/src/routes/projects/runs";
import { useKy } from "./composables/ky";

export async function getProjects(): Promise<ProjectsForUser> {
  const ky = useKy();
  const res = await ky.get<{ projects: ProjectsForUser }>("/api/me");
  return res.json();
}

export async function getProject(projectId: string): Promise<ProjectView> {
  const ky = useKy();
  const res = await ky.get<ProjectView>(`/api/projects/${projectId}/runs`);
  return res.json();
}
