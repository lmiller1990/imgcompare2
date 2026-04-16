<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useKy } from "../composables/ky";

const ky = useKy();
const email = ref("");
const password = ref("");
const error = ref("");
const router = useRouter();

async function signUp() {
  error.value = "";
  try {
    await ky.post("/api/signup", {
      json: { email: email.value, password: password.value },
    });
    router.push("/");
  } catch {
    error.value = "Sign up failed. Please try again.";
  }
}
</script>

<template>
  <form @submit.prevent="signUp">
    <fieldset
      class="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4"
    >
      <legend class="fieldset-legend">Sign Up</legend>

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

      <button class="btn btn-neutral mt-4">Sign Up</button>
    </fieldset>
  </form>
</template>
