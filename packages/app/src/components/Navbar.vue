<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { useKy } from "../composables/ky";
import { getProject } from "../api";
import { useRoute } from "vue-router";

const ky = useKy();
const route = useRoute();

async function logout() {
  await ky.post("/api/logout");
  location.href = "/login";
}

const { state: projectState } = useQuery({
  key: () => ["project", route.params.projectId],
  query: () => getProject(route.params.projectId as string),
  enabled: !!route.params.projectId,
});
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm">
    <div class="flex flex-1 items-center">
      <RouterLink class="btn btn-ghost text-xl" to="/projects"
        >Visual Tester</RouterLink
      >
      <RouterLink
        v-if="route.params.projectId"
        :to="`/projects/${route.params.projectId}/runs`"
      >
        {{ projectState.data?.name }}
      </RouterLink>
    </div>
    <div class="flex-none">
      <ul class="menu menu-horizontal px-1">
        <li>
          <details>
            <summary>Menu</summary>
            <ul class="bg-base-200 rounded-t-none p-2">
              <li><RouterLink to="/projects">Projects</RouterLink></li>
              <li><a @click="logout">Logout</a></li>
            </ul>
          </details>
        </li>
      </ul>
    </div>
  </div>
</template>
