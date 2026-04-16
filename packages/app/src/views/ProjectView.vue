<script setup lang="ts">
import type { ProjectWithRunsAndBaseline } from "@packages/server/src/db/queries";
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useKy } from "../composables/ky";

const ky = useKy();
const project = ref<ProjectWithRunsAndBaseline>();
const route = useRoute();

const res = await ky.get<ProjectWithRunsAndBaseline>(
  `/api/projects/${route.params.projectId}`,
);
project.value = await res.json();
</script>

<template>
  <div v-if="project">
    <h1 class="text-2xl font-bold mb-4">{{ project.name }}</h1>

    <div class="mb-6" v-if="project.baselines[0]">
      <h2 class="text-lg font-semibold mb-2">Active Baseline</h2>
      <div class="rounded-box border border-base-content/5 bg-base-100 p-4">
        <p class="text-sm">ID: {{ project.baselines[0].id }}</p>
        <p class="text-sm">Created: {{ project.baselines[0].createdAt }}</p>
      </div>
    </div>

    <h2 class="text-lg font-semibold mb-2">Runs</h2>
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Completed At</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in project.runs" :key="run.id">
            <td>
              <RouterLink
                class="link"
                :to="`/projects/${route.params.projectId}/runs/${run.id}`"
              >
                {{ run.id }}
              </RouterLink>
            </td>
            <td>{{ run.status }}</td>
            <td>{{ run.completedAt }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
