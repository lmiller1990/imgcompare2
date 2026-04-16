<script setup lang="ts">
import { onErrorCaptured } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

if (router.currentRoute.value.meta["public"]) {
  //
}
</script>

<template>Error</template>
