<script setup lang="ts">
import { DateTime } from "luxon";
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useKy } from "../composables/ky";
import type { ProjectView } from "@packages/server/src/routes/projects/runs";
import { nicelyFormat } from "../utils/datetime";

const ky = useKy();
const project = ref<ProjectView>();
const route = useRoute();
const router = useRouter();

const res = await ky.get<ProjectView>(
  `/api/projects/${route.params.projectId}/runs`,
);
project.value = await res.json();

function handleNavToRun(runId: string) {
  router.push(`/projects/${route.params.projectId}/runs/${runId}`);
}

function timeAgo(dt: string) {
  const formatted = DateTime.fromISO(dt, { zone: "utc" });
  return formatted.toRelative();
}
</script>

<template>
  <div v-if="project">
    <div class="flex justify-end items-center">
      <div v-if="project.activeBaseline">
        <div class="rounded-box border border-base-content/5 bg-base-10 mb-2">
          <p class="text-sm">
            Active baseline:
            <RouterLink
              class="link"
              :to="`/projects/${route.params.projectId}/runs/${project.activeBaseline.id}`"
            >
              Run #{{ project.activeBaseline.runNumber }}
            </RouterLink>
          </p>
          <p class="text-sm">
            {{ nicelyFormat(project.activeBaseline.createdAt) }}
          </p>
        </div>
      </div>
    </div>

    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table">
        <thead>
          <tr>
            <th>Run Number</th>
            <th>Info</th>
            <th>Status</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="run in project.runs"
            :key="run.id"
            class="cursor-pointer"
            @click="() => handleNavToRun(run.id)"
          >
            <td>
              <div class="text-xl">#{{ run.runNumber }}</div>
              <div>{{ timeAgo(run.createdAt) }}</div>
              <div
                v-if="run.id == project.activeBaseline?.id"
                class="badge badge-soft badge-accent"
              >
                Baseline
              </div>
            </td>
            <td>
              <div v-if="run.source">
                <code>{{ run.source.branch }}</code>
                <div :title="run.source.commitHash">
                  {{ run.source.commitHash?.slice(0, 7) }}
                </div>
              </div>
            </td>
            <td>
              <div class="badge badge-info badge-sm">
                {{ run.status }}
              </div>
            </td>
            <td>{{ nicelyFormat(run.createdAt.toString()) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
