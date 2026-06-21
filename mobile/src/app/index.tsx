import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/(auth)/login'} />;
}
