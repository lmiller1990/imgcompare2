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
    <h1 class="text-2xl font-bold mb-4">{{ project.name }}</h1>

    <div class="mb-6" v-if="project.activeBaseline">
      <h2 class="text-lg font-semibold mb-2">Active Baseline</h2>
      <div class="rounded-box border border-base-content/5 bg-base-100 p-4">
        <p class="text-sm">ID: {{ project.activeBaseline.id }}</p>
        <p class="text-sm">Created: {{ project.activeBaseline.createdAt }}</p>
      </div>
    </div>

    <h2 class="text-lg font-semibold mb-2">Runs</h2>
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table">
        <thead>
          <tr>
            <th>Run Number</th>
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
              <div class="text-xl">
                {{ run.runNumber }}
              </div>
              <div>{{ timeAgo(run.createdAt) }}</div>
              {{ run.id == project.activeBaseline?.id ? "Baseline" : null }}
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
