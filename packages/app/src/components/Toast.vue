<script setup lang="ts">
import { useToast } from "../composables/useToast";

const { toastState } = useToast();
</script>

<template>
  <div class="toast toast-top toast-end">
    <div v-if="toastState?.type === 'success'" class="alert alert-success">
      <span>{{ toastState.message }}</span>
    </div>
    <div v-if="toastState?.type === 'info'" class="alert alert-info">
      <span>{{ toastState.message }}</span>
    </div>
    <div v-if="toastState?.type === 'alert'" class="alert alert-warning">
      <span>{{ toastState.message }}</span>
    </div>
    <div v-if="toastState?.type === 'error'" class="alert alert-error">
      <span>{{ toastState.message }}</span>
    </div>
  </div>
</template>
