<script setup lang="ts">
import HandleError from "./components/HandleError.vue";
import Navbar from "./components/Navbar.vue";
import StartHere from "./components/StartHere.vue";
import Toast from "./components/Toast.vue";
</script>

<template>
  <Toast />
  <Navbar />
  <Suspense>
    <StartHere />
    <template #fallback>
      <HandleError />
    </template>
  </Suspense>
</template>
