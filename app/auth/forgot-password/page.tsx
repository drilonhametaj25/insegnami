import { redirect } from 'next/navigation';

export default function ForgotPasswordRedirect() {
  redirect('/it/auth/forgot-password');
}
