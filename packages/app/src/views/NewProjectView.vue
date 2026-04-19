<script setup lang="ts">
import { ref } from "vue";
import { useKy } from "../composables/ky";
import { useRouter } from "vue-router";

const ky = useKy();
const name = ref("");
const router = useRouter();

async function handleCreateProject() {
  const res = await ky.post<{ id: string }>("/api/projects", {
    json: {
      name: name.value,
    },
  });
  const project = await res.json();
  router.push(`/projects/${project.id}/runs`);
}
</script>

<template>
  <form @submit.prevent="handleCreateProject">
    <fieldset
      class="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4"
    >
      <input v-model="name" class="input" placeholder="Name" />

      <button class="btn btn-neutral mt-4">Create Project</button>
    </fieldset>
  </form>
</template>
