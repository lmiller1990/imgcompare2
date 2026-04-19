<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useKy } from "../composables/ky";
import type { ProjectView } from "@packages/server/src/routes/projects/runs";

const ky = useKy();
const project = ref<ProjectView>();
const route = useRoute();

const res = await ky.get<ProjectView>(
  `/api/projects/${route.params.projectId}/runs`,
);
project.value = await res.json();
</script>

<template>
  Length:
  <div
    class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
  >
    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Status</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="run of project?.runs" :key="run.id">
          <td>
            <RouterLink
              class="link"
              :to="`/projects/${route.params.projectId}/runs/${run.id}`"
            >
              {{ run.id }}
            </RouterLink>
          </td>
          <td>{{ run.status }}</td>
          <td>{{ run.createdAt }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
