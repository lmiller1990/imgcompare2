<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useKy } from "../composables/ky";

const email = ref("");
const password = ref("");
const error = ref("");
const router = useRouter();

const ky = useKy();

async function login() {
  error.value = "";
  console.log("Logging in...");
  try {
    await ky.post("/api/login", {
      json: { email: email.value, password: password.value },
    });
    router.push("/projects");
  } catch {
    error.value = "Invalid email or password.";
  }
}
</script>

<template>
  <form @submit.prevent="login">
    <fieldset
      class="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4"
    >
      <legend class="fieldset-legend">Login</legend>

      <label class="label">Email</label>
      <input v-model="email" type="email" class="input" placeholder="Email" />

      <label class="label">Password</label>
      <input
        v-model="password"
        type="password"
        class="input"
        placeholder="Password"
      />

      <p v-if="error" class="text-error text-sm mt-2">{{ error }}</p>

      <button class="btn btn-neutral mt-4">Login</button>
    </fieldset>
  </form>
</template>
