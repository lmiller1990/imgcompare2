<script setup lang="ts">
import ky from "ky";
import { useRoute } from "vue-router";

//
const route = useRoute();

const res = await ky.get(
  `/api/projects/${route.params.projectId}/runs/${route.params.runId}`,
);

console.log(await res.json());
</script>

<template>
  hello friend
  <!--  -->
</template>
