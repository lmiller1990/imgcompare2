<script setup lang="ts">
import { useProjectsQuery } from "../api";

const { state: projectsList, asyncStatus } = useProjectsQuery();
</script>

<template>
  <div class="flex items-center justify-between">
    <h2 class="text-xl">Projects</h2>
    <div class="flex justify-end mb-2">
      <RouterLink class="btn" to="/projects/new">Create Project</RouterLink>
    </div>
  </div>

  <div v-if="asyncStatus === 'loading'" />
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
          <tr v-for="project in projectsList.data.projects" :key="project.id">
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
