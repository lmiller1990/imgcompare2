<script setup lang="ts">
import ky from "ky";

await ky.get("/api/me");
</script>

<template>
  <RouterView />
</template>
