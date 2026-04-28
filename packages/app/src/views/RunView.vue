<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useKy } from "../composables/ky";
import type { RunWithResultDto } from "@packages/server/src/routes/projects/runs";
import { useToast } from "../composables/useToast";
import { useProjectRunQuery } from "../api";
import { getLatestStateTransition } from "../utils/runUtils";
import { computed } from "vue";

const route = useRoute();
const router = useRouter();
const ky = useKy();
const toast = useToast();

const projectId = computed(() => route.params.projectId as string | undefined);

const runId = computed(() => route.params.runId as string | undefined);

const enabled = computed(() => Boolean(projectId.value && runId.value));
const {
  state: runState,
  asyncStatus,
  status,
  error,
} = useProjectRunQuery(projectId, runId, enabled);

function formatPercent(value: number) {
  return (value * 100).toFixed(2) + "%";
}

async function handleApprove() {
  await ky.post<RunWithResultDto>(
    `/api/projects/${route.params.projectId}/runs/${route.params.runId}/approve`,
  );
  toast.show("Run approved.");
  router.push(`/projects/${route.params.projectId}/runs`);
}
</script>

<template>
  <div v-if="asyncStatus === 'loading'">Loading...</div>
  <div v-else-if="status === 'error'">Error. {{ error }}</div>
  <template v-else-if="runState.data">
    <div
      v-if="
        getLatestStateTransition(runState.data.run.stateTransitions)
          .transitionedTo === 'unreviewed'
      "
      class="my-2"
    >
      <form @submit.prevent="handleApprove">
        <button class="btn btn-success btn-sm">Approve</button>
      </form>
    </div>
    <div
      class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 max-w-[80%]"
    >
      <table class="table">
        <thead>
          <tr>
            <th>Baseline</th>
            <th>Incoming</th>
            <th>Comparison</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="result of runState.data.reviewableResult"
            :key="result.name"
          >
            <td>
              <img
                v-if="result.baseline?.imagePath"
                :src="result.baseline.imagePath"
              />
              <div v-else>
                No baseline. Approving will set the snapshot to the baseline.
              </div>
            </td>

            <td>
              <img
                v-if="result.snapshot?.imagePath"
                :src="result.snapshot.imagePath"
              />
              <div v-else>Snapshot missing! Tested deleted?</div>
            </td>

            <td>
              <div v-if="result.comparison?.diff">
                <img :src="result.comparison.diff.imagePath" />
                Percentage diff:
                {{ formatPercent(result.comparison?.diff.difference) }}
              </div>
              <div v-else>No diff</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
