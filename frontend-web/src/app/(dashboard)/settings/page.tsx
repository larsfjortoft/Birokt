'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Bell, Shield, Database, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const router = useRouter();
  const { user, checkAuth, logout } = useAuthStore();

  // Profile form
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name?: string; phone?: string | null }) =>
      authApi.updateProfile(data),
    onSuccess: () => {
      toast.success('Profil oppdatert!');
      checkAuth();
    },
    onError: () => {
      toast.error('Kunne ikke oppdatere profilen');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: async () => {
      toast.success('Passord endret!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => {
      toast.error('Feil passord eller nytt passord oppfyller ikke kravene');
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: async () => {
      await logout();
      router.push('/login');
    },
    onError: () => {
      toast.error('Kunne ikke slette kontoen');
    },
  });

  const handleProfileSave = () => {
    updateProfileMutation.mutate({
      name: profileName || undefined,
      phone: profilePhone || null,
    });
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passordene samsvarer ikke');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Passord må være minst 8 tegn');
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== 'SLETT') return;
    deleteAccountMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Innstillinger</h1>
        <p className="text-gray-500">Administrer din konto og preferanser</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-honey-100 rounded-full flex items-center justify-center">
              <span className="text-honey-700 font-bold text-2xl">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user?.name}</p>
              <p className="text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Navn
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-post
              </label>
              <input
                type="email"
                defaultValue={user?.email}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-50"
                disabled
              />
              <p className="text-xs text-gray-400 mt-1">E-post kan ikke endres</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="Valgfritt"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
              />
            </div>
            <Button
              onClick={handleProfileSave}
              isLoading={updateProfileMutation.isPending}
            >
              Lagre endringer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Varsler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Inspeksjonspåminnelser</p>
                <p className="text-sm text-gray-500">Få varsel når det er på tide å inspisere</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 text-honey-500 rounded focus:ring-honey-500"
                disabled
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Værvarsler</p>
                <p className="text-sm text-gray-500">Bli varslet om gode inspeksjonsforhold</p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 text-honey-500 rounded focus:ring-honey-500"
                disabled
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Varslinger kommer i en fremtidig versjon.
          </p>
        </CardContent>
      </Card>

      {/* Security - Password change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Sikkerhet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nåværende passord
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nytt passord
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bekreft nytt passord
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-honey-500"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              isLoading={changePasswordMutation.isPending}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              Endre passord
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Gå til Rapporter-siden for å laste ned dine data i CSV- eller PDF-format.
          </p>
          <Button variant="outline" onClick={() => router.push('/reports')}>
            Gå til rapporter
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Faresone
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                Slett konto
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                Permanent sletting av konto og alle data. Denne handlingen kan ikke angres.
              </p>
            </>
          ) : (
            <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800">
                Er du sikker? Skriv SLETT for å bekrefte:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="SLETT"
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'SLETT'}
                  isLoading={deleteAccountMutation.isPending}
                >
                  Slett konto permanent
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                >
                  Avbryt
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
