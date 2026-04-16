import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { createRouter, createWebHistory } from "vue-router";
import SignUpView from "./views/SignUpView.vue";
import LoginView from "./views/LoginView.vue";
import ProjectsView from "./views/ProjectsView.vue";
import RunsView from "./views/RunsView.vue";
import RunView from "./views/RunView.vue";
import { installKy } from "./composables/ky";
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
      path: "/projects/:projectId",
      component: ProjectView,
    },
    {
      path: "/projects",
      component: ProjectsView,
      children: [
        {
          path: ":projectId/runs",
          component: RunsView,
        },
      ],
    },
  ],
});

const app = createApp(App);
app.use(router);
app.use(installKy, router);
app.mount("#app");
