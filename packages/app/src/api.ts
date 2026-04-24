import type { ProjectsForUser } from "@packages/server/src/db/projects";
import type {
  ProjectView,
  RunWithResultDto,
} from "@packages/server/src/routes/projects/runs";
import { useKy } from "./composables/ky";
import { HTTPError } from "ky";
import { useRouter } from "vue-router";
import { useQuery } from "@pinia/colada";
export function useProjectsQuery() {
  const ky = useKy();
  return useQuery({
    key: () => ["me"],
    query: async () => {
      const res = await ky.get<{ projects: ProjectsForUser }>("/api/me");
      return res.json();
    },
  });
}

export function useProjectRunQuery(projectId: string, runId: string) {
  const ky = useKy();
  return useQuery({
    key: () => ["projectRun", projectId, runId],
    query: async () => {
      const res = await ky.get<RunWithResultDto>(
        `/api/projects/${projectId}/runs/${runId}`,
      );
      return res.json();
    },
  });
}

export async function getProject(projectId: string): Promise<ProjectView> {
  const ky = useKy();
  const res = await ky.get<ProjectView>(`/api/projects/${projectId}/runs`);
  return res.json();
}

export async function signUp(email: string, password: string): Promise<void> {
  const ky = useKy();
  await ky.post("/api/signup", {
    json: { email, password },
  });
}

export function useMeQuery() {
  const ky = useKy();
  const router = useRouter();
  return useQuery({
    key: () => ["me"],
    query: async () => {
      try {
        const res = await ky.get<ProjectsForUser>("/api/me");
        return res.json();
      } catch (e) {
        if (e instanceof HTTPError) {
          if (e.response.status === 401) {
            console.info("/api/me returned 401 - need to reauthenticate");
            router.push("/login");
          } else {
            throw e;
          }
        }
      }
    },
  });
}
