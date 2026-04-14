<script setup lang="ts">
import ky from "ky";
import { ref } from "vue";
import { useRouter } from "vue-router";

async function me() {
  await ky.get("/me");
}

me();
</script>

<template>Projects</template>
