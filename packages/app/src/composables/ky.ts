import ky from "ky";
import type { Plugin } from "vue";
import { inject } from "vue";
import type { useRouter } from "vue-router";

const kySym = Symbol("ky");

export const installKy: Plugin = (
  app,
  router: ReturnType<typeof useRouter>,
) => {
  const api = ky.create({
    hooks: {
      afterResponse: [
        async ({ request, options, response }) => {
          if (response.status === 401) {
            if (!router.currentRoute.value.meta["public"]) {
              location.href = "/login";
            }
          }
        },
      ],
    },
  });

  app.provide(kySym, api);
};

export function useKy() {
  return inject(kySym) as typeof ky;
}
