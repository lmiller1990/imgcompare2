import type {
  ProjectView,
  RunWithResultDto,
} from "@packages/server/src/routes/projects/runs";
import { useKy } from "./composables/ky";
import { HTTPError } from "ky";
import { useRouter } from "vue-router";
import { useQuery } from "@pinia/colada";
import type { ComputedRef } from "vue";
import type { Project } from "@packages/server/src/domain";

export function useProjectsQuery() {
  const ky = useKy();
  return useQuery({
    key: () => ["me"],
    query: async () => {
      const res = await ky.get<Project[]>("/api/me");
      return res.json();
    },
  });
}

export function useProjectRunQuery(
  projectId: ComputedRef<string | undefined>,
  runId: ComputedRef<string | undefined>,
  enabled: ComputedRef<boolean>,
) {
  const ky = useKy();
  return useQuery({
    enabled,
    key: () => ["projectRun", projectId.value ?? null, runId.value ?? null],
    query: async () => {
      const res = await ky.get<RunWithResultDto>(
        `/api/projects/${projectId.value}/runs/${runId.value}`,
      );
      return res.json();
    },
  });
}

export function useProjectQuery(
  projectId: ComputedRef<string | undefined>,
  enabled: ComputedRef<boolean>,
) {
  const ky = useKy();
  return useQuery({
    enabled,
    key: () => ["projectId", projectId.value ?? null],
    query: async () => {
      const res = await ky.get<ProjectView>(
        `/api/projects/${projectId.value}/runs`,
      );
      return res.json();
    },
  });
}

export async function signUp(email: string, password: string): Promise<void> {
  const ky = useKy();
  console.log("Posting...");
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
        const res = await ky.get<Project[]>("/api/me");
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
