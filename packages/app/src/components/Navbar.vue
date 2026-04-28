<script setup lang="ts">
import { useKy } from "../composables/ky";
import { useProjectQuery, useProjectRunQuery } from "../api";
import { useRoute } from "vue-router";
import Chevron from "./Chevron.vue";
import { computed } from "vue";
import RunStatusBadge from "./RunStatusBadge.vue";
import { getLatestStateTransition } from "../utils/runUtils";

const ky = useKy();
const route = useRoute();

async function logout() {
  await ky.post("/api/logout");
  location.href = "/login";
}

const projectId = computed(() => route.params.projectId as string | undefined);
const runId = computed(() => route.params.runId as string | undefined);
const enabled = computed(() => !!projectId.value);
const { state: projectState } = useProjectQuery(projectId, enabled);

const runQueryEnabled = computed(() => Boolean(projectId.value && runId.value));
const { state: runState } = useProjectRunQuery(
  projectId,
  runId,
  runQueryEnabled,
);
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm">
    <div class="flex flex-1 items-center">
      <div class="flex gap-4 items-center">
        <RouterLink class="text-xl" to="/projects">Visual Tester</RouterLink>
        <template v-if="projectState.data">
          <Chevron />
          <RouterLink
            v-if="route.params.projectId"
            :to="`/projects/${route.params.projectId}/runs`"
          >
            {{ projectState.data.name }}
          </RouterLink>
        </template>

        <div v-if="runState.data" class="flex items-center gap-2">
          <Chevron />
          <div>#{{ runState.data.run.runNumber }}</div>
          <RunStatusBadge
            :status="
              getLatestStateTransition(runState.data.run.stateTransitions)
                .transitionedTo
            "
          />
        </div>
      </div>
    </div>

    <div class="flex-none">
      <ul class="menu menu-horizontal px-1">
        <li>
          <details>
            <summary>Menu</summary>
            <ul class="bg-base-200 rounded-t-none p-2">
              <li><RouterLink to="/projects">Projects</RouterLink></li>
              <li><a @click="logout">Logout</a></li>
            </ul>
          </details>
        </li>
      </ul>
    </div>
  </div>
</template>
