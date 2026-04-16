<script setup lang="ts">
import { HTTPError } from "ky";
import { useKy } from "../composables/ky";
import { useRouter } from "vue-router";

const ky = useKy();
const router = useRouter();

try {
  await ky.get("/api/me");
} catch (e) {
  if (e instanceof HTTPError) {
    if (e.response.status === 401) {
      console.info("/api/me returned 401 - need to reauthenticate");
      router.push("/login");
    } else {
      throw e;
    }
  }
}
</script>

<template>
  <RouterView />
</template>
