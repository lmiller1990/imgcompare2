import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { createRouter, createWebHistory } from "vue-router";
import SignUpView from "./views/SignUpView.vue";
import LoginView from "./views/LoginView.vue";
import ProjectsView from "./views/ProjectsView.vue";
import RunView from "./views/RunView.vue";
import { installKy } from "./composables/ky";
import { createPinia } from "pinia";
import { PiniaColada } from "@pinia/colada";
import ProjectView from "./views/ProjectView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/sign_up",
      component: SignUpView,
      meta: {
        public: true,
      },
    },
    {
      path: "/login",
      component: LoginView,
      meta: {
        public: true,
      },
    },
    {
      path: "/projects/:projectId/runs/:runId",
      component: RunView,
    },
    {
      path: "/projects/:projectId/runs",
      component: ProjectView,
    },
    {
      path: "/projects",
      component: ProjectsView,
    },
  ],
});

const app = createApp(App);
app.use(router);
app.use(installKy, router);
app.use(createPinia());
app.use(PiniaColada, {
  queryOptions: {
    // change the stale time for all queries to 0ms
    staleTime: 0,
  },
  mutationOptions: {
    // add global mutation options here
  },
  plugins: [
    // add Pinia Colada plugins here
  ],
});

app.mount("#app");
