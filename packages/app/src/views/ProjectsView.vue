<script setup lang="ts">
import ky from "ky";
import { ref } from "vue";
import { useRouter } from "vue-router";
import type { ProjectsForUser } from "@packages/server/src/db/projects";

async function me() {
  const res = await ky.get<{ projects: ProjectsForUser }>("/api/me");
  return res.json();
}

const router = useRouter();
const name = ref("");

const projects = ref<ProjectsForUser>([]);

async function handleCreateProject() {
  await ky.post<{ id: string }>("/api/projects", {
    json: {
      name: name.value,
    },
  });
  router.push("/");
}

const result = await me();
projects.value = result.projects;
</script>

<template>
  Projects
  <form @submit.prevent="handleCreateProject">
    <fieldset
      class="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4"
    >
      <legend class="fieldset-legend">New Project</legend>

      <label class="label">Name</label>
      <input v-model="name" class="input" placeholder="Name" />

      <button class="btn btn-neutral mt-4">Create Project</button>
    </fieldset>
  </form>

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

  <RouterView />
</template>
