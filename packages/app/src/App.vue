<script setup lang="ts">
import HandleError from "./components/HandleError.vue";
import StartHere from "./components/StartHere.vue";
import Toast from "./components/Toast.vue";
import { useKy } from "./composables/ky";

const ky = useKy();

async function logout() {
  await ky.post("/api/logout");
  location.href = "/login";
}
</script>

<template>
  <Toast />
  <button @click="logout">Logout</button>
  <Suspense>
    <StartHere />
    <template #fallback>
      <HandleError />
    </template>
  </Suspense>
</template>
