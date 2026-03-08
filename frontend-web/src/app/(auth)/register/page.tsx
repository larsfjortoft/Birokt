'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passordene stemmer ikke overens');
      return;
    }

    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, name);
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { error?: { message?: string; details?: Array<{ message: string }> } };
      if (error?.error?.details) {
        setError(error.error.details.map(d => d.message).join('. '));
      } else {
        setError(error?.error?.message || 'Registrering feilet. Prøv igjen.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 text-5xl">🐝</div>
        <CardTitle className="text-2xl">Opprett konto</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Kom i gang med digital birøkt
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <Input
            label="Navn"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ola Nordmann"
            required
            autoComplete="name"
          />

          <Input
            label="E-post"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@epost.no"
            required
            autoComplete="email"
          />

          <Input
            label="Passord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minst 8 tegn"
            required
            autoComplete="new-password"
          />

          <Input
            label="Bekreft passord"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Gjenta passordet"
            required
            autoComplete="new-password"
          />

          <p className="text-xs text-gray-500">
            Passordet må inneholde minst 8 tegn, en stor bokstav, en liten bokstav,
            et tall og et spesialtegn.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Opprett konto
          </Button>

          <p className="text-sm text-center text-gray-600">
            Har du allerede en konto?{' '}
            <Link href="/login" className="text-honey-600 hover:text-honey-700 font-medium">
              Logg inn
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
