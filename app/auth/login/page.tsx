import { redirect } from 'next/navigation';

export default function LoginRedirect() {
  redirect('/it/auth/login');
}
