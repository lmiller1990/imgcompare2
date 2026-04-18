import { ref, computed } from "vue";

interface ToastState {
  message: string;
  type: "success" | "info" | "alert" | "error";
}

const toastState = ref<ToastState | null>(null);

export function useToast() {
  const show = (
    message: string,
    options: { type: ToastState["type"] } = { type: "success" },
  ) => {
    toastState.value = {
      message,
      type: options.type,
    };

    setTimeout(() => {
      toastState.value = null;
    }, 2000);
  };

  return {
    toastState: computed(() => toastState.value),
    show,
  };
}
