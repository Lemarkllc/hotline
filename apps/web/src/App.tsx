import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "@/routes/router";
import { useMe } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AppSkeleton } from "@/components/mobile/AppSkeleton";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});

function Bootstrap() {
  const { isLoading } = useMe(); // синхронизирует роли/permissions/каналы с сервером при загрузке приложения
  const isMobile = useIsMobile();
  const accessToken = useAuthStore((s) => s.accessToken);

  // Эстафета от статического сплэша (index.html): пока известен токен, но реальный
  // пользователь/права ещё не пришли — скелетон вместо мигания недологиненного роутера
  // (Sidebar/tab bar без пунктов меню, hasPermission() всюду false до первого ответа).
  if (isMobile && accessToken && isLoading) {
    return <AppSkeleton />;
  }

  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Bootstrap />
    </QueryClientProvider>
  );
}
