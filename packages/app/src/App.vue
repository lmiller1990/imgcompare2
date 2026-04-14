<script setup lang="ts">
import StartHere from "./components/StartHere.vue";
</script>

<template>
  <Suspense>
    <StartHere />
    <template #fallback> Loading... </template>
  </Suspense>
</template>
