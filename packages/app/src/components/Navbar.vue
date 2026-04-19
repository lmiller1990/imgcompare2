<script setup lang="ts">
import { useKy } from "../composables/ky";

const ky = useKy();

async function logout() {
  await ky.post("/api/logout");
  location.href = "/login";
}
</script>

<template>
  <div class="navbar bg-base-100 shadow-sm">
    <div class="flex-1">
      <a class="btn btn-ghost text-xl">Visual Tester</a>
    </div>
    <div class="flex-none">
      <ul class="menu menu-horizontal px-1">
        <li>
          <details>
            <summary>Menu</summary>
            <ul class="bg-base-100 rounded-t-none p-2">
              <li><a @click="logout">Logout</a></li>
              <li><RouterLink to="/projects">Projects</RouterLink></li>
            </ul>
          </details>
        </li>
      </ul>
    </div>
  </div>
</template>
