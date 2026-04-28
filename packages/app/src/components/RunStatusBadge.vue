<script lang="ts" setup>
import type { RunStateTransition } from "@packages/server/src/domain";

const props = defineProps<{
  status: RunStateTransition["transitionedTo"];
}>();
</script>

<template>
  <div
    :class="{
      'badge-warning': status === 'unreviewed',
      'badge-info': status === 'pending',
      'badge-error': status === 'rejected',
      'badge-success': status === 'approved',
    }"
    class="badge badge-sm"
  >
    {{ status }}
  </div>
</template>
