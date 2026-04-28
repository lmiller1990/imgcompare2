<script setup lang="ts">
import { useRouter } from "vue-router";
import { useMeQuery } from "../api";

const router = useRouter();
// This checks if logged in. If yes, continue, if not, redirect to /login
useMeQuery();
await router.isReady();
</script>

<template>
  <RouterView />
</template>
