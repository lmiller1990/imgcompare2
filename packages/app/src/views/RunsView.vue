<script setup lang="ts">
import type { RunsForProject } from "@packages/server/src/db/queries";
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useKy } from "../composables/ky";

const ky = useKy();
const runs = ref<RunsForProject>();
const route = useRoute();

const res = await ky.get<RunsForProject>(
  `/api/projects/${route.params.projectId}/runs`,
);
runs.value = await res.json();
</script>

<template>
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
        <tr v-for="run in runs" :key="run.id">
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
</template>
