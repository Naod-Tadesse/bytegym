import { createFileRoute } from '@tanstack/react-router';

import { LoginForm } from '@/features/auth/login';

export const Route = createFileRoute('/auth/login')({
  component: LoginForm,
});
