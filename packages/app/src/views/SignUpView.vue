<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useMutation } from "@pinia/colada";
import { signUp } from "../api";

const email = ref("");
const password = ref("");
const error = ref("");
const router = useRouter();

const {
  mutate: handleSignup,
  status,
  asyncStatus,
} = useMutation({
  mutation: async () => {
    await signUp(email.value, password.value);
    router.push("/");
  },
});
</script>

<template>
  <form @submit.prevent="() => handleSignup">
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

      <button
        :disabled="asyncStatus === 'loading'"
        class="btn btn-neutral mt-4"
      >
        Sign Up
      </button>
      <div v-if="status === 'error'">An error occurred. Please try again.</div>
    </fieldset>
  </form>
</template>
