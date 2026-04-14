import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { createRouter, createWebHistory } from "vue-router";
import SignUpView from "./views/SignUpView.vue";
import LoginView from "./views/LoginView.vue";
import ProjectsView from "./views/ProjectsView.vue";
import RunsView from "./views/RunsView.vue";
import RunView from "./views/RunView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/sign_up",
      component: SignUpView,
    },
    {
      path: "/login",
      component: LoginView,
    },
    {
      path: "/projects/:projectId/runs/:runId",
      component: RunView,
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

createApp(App).use(router).mount("#app");
