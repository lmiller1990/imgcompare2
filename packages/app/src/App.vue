<script setup lang="ts">
import { onErrorCaptured } from "vue";
import HandleError from "./components/HandleError.vue";
import StartHere from "./components/StartHere.vue";
</script>

<template>
  <Suspense>
    <StartHere />
    <template #fallback>
      <HandleError />
    </template>
  </Suspense>
</template>
