<script setup lang="ts">
import HandleError from "./components/HandleError.vue";
import StartHere from "./components/StartHere.vue";
import Toast from "./components/Toast.vue";
</script>

<template>
  <Toast />
  <Suspense>
    <StartHere />
    <template #fallback>
      <HandleError />
    </template>
  </Suspense>
</template>
