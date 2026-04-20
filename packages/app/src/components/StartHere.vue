<script setup lang="ts">
import { useMeQuery } from "../api";

// This checks if logged in. If yes, continue, if not, redirect to /login
useMeQuery();
</script>

<template>
  <RouterView />
</template>
