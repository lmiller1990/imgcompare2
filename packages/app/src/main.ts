import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "sign_up",
      component: SignUpView,
    },
    {
      path: "login",
      component: LoginView,
    },
  ],
});

createApp(App).use(router).mount("#app");
