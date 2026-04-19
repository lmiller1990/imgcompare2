<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import type { ProjectsForUser } from "@packages/server/src/db/projects";
import { useQuery } from "@pinia/colada";
import { getProjects } from "../api";
import { useKy } from "../composables/ky";

const ky = useKy();

async function me() {
  const res = await ky.get<{ projects: ProjectsForUser }>("/api/me");
  return res.json();
}

const router = useRouter();

const projects = ref<ProjectsForUser>([]);

const result = await me();
projects.value = result.projects;

const {
  state: projectsList,
  asyncStatus,
  // refresh,
} = useQuery({
  key: ["projects-list"],
  query: getProjects,
});
</script>

<template>
  Projects
  <div v-if="asyncStatus === 'loading'" />

  <div class="flex justify-end mb-2">
    <RouterLink class="btn" to="/projects/new">Create Project</RouterLink>
  </div>

  <div v-if="projectsList.error">
    <div :error="projectsList.error" />
  </div>
  <div v-else-if="projectsList.data">
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"
    >
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in projects" :key="project.id">
            <td>
              <RouterLink class="link" :to="`/projects/${project.id}/runs`">
                {{ project.name }}
              </RouterLink>
            </td>
            <td>{{ project.createdAt }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <RouterView />
</template>
