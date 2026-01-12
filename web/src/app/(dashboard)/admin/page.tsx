'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import type { User, UserRole } from '@/types';

const roleOptions = [
  { value: 'vendeur', label: 'Vendeur' },
  { value: 'gestionnaire_commandes', label: 'Gestionnaire Commandes' },
  { value: 'gestionnaire_stocks', label: 'Gestionnaire Stocks' },
  { value: 'admin', label: 'Administrateur' },
];

interface NewUserForm {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: UserRole;
  password?: string;
}

type PasswordMode = 'auto' | 'manual';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('vendeur');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('auto');
  const [newUser, setNewUser] = useState<NewUserForm>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'vendeur',
    password: '',
  });
  const [generatedPassword, setGeneratedPassword] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: NewUserForm) => api.createUser(data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setGeneratedPassword(data.generated_password || '');
      toast.success('Utilisateur cree', `${data.username} a ete cree avec succes`);
      if (!data.generated_password) {
        setShowCreateModal(false);
        setNewUser({
          username: '',
          email: '',
          first_name: '',
          last_name: '',
          phone: '',
          role: 'vendeur',
        });
      }
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors de la creation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur modifie', 'Les modifications ont ete enregistrees');
      setShowEditModal(false);
      setEditingUser(null);
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors de la modification');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur desactive', 'L\'utilisateur a ete desactive');
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors de la desactivation');
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const userData = passwordMode === 'manual' && newUser.password
      ? newUser
      : { ...newUser, password: undefined };
    createMutation.mutate(userData);
  };

  const handleEditRole = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
    setShowEditModal(true);
  };

  const handleUpdateRole = () => {
    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        data: { role: editRole },
      });
    }
  };

  const handleReactivate = (user: User) => {
    if (confirm(`Réactiver l'utilisateur ${user.first_name} ${user.last_name} ?`)) {
      updateMutation.mutate({
        id: user.id,
        data: { is_active: true },
      });
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setGeneratedPassword('');
    setPasswordMode('auto');
    setNewUser({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: 'vendeur',
      password: '',
    });
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Administration</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestion des utilisateurs et du système</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          Nouvel utilisateur
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Utilisateurs</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Téléphone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Dernière connexion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users?.results?.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={user.role === 'admin' ? 'danger' : 'default'}
                      >
                        {user.role_display}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.last_login
                        ? formatDateTime(user.last_login)
                        : 'Jamais'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRole(user)}
                          disabled={user.role === 'admin'}
                        >
                          Modifier rôle
                        </Button>
                        {user.is_active ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (confirm('Désactiver cet utilisateur ?')) {
                                deleteMutation.mutate(user.id);
                              }
                            }}
                            disabled={user.role === 'admin'}
                          >
                            Désactiver
                          </Button>
                        ) : (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleReactivate(user)}
                          >
                            Réactiver
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Nouvel utilisateur</h2>

            {generatedPassword ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-300 font-medium">
                    Utilisateur créé avec succès !
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Mot de passe généré :
                  </p>
                  <p className="font-mono text-lg bg-white dark:bg-slate-800 p-2 rounded mt-1 text-gray-900 dark:text-white">
                    {generatedPassword}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    Notez ce mot de passe, il ne sera plus affiché.
                  </p>
                </div>
                <Button onClick={closeModal} className="w-full">
                  Fermer
                </Button>
              </div>
            ) : passwordMode === 'manual' && !generatedPassword && createMutation.isSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-300 font-medium">
                    Utilisateur créé avec succès !
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Le mot de passe personnalisé a été enregistré.
                  </p>
                </div>
                <Button onClick={closeModal} className="w-full">
                  Fermer
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <Input
                  label="Nom d'utilisateur"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Prénom"
                    value={newUser.first_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, first_name: e.target.value })
                    }
                  />
                  <Input
                    label="Nom"
                    value={newUser.last_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, last_name: e.target.value })
                    }
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                />
                <Input
                  label="Téléphone"
                  value={newUser.phone}
                  onChange={(e) =>
                    setNewUser({ ...newUser, phone: e.target.value })
                  }
                />
                <Select
                  label="Rôle"
                  options={roleOptions}
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value as UserRole })
                  }
                />

                {/* Password Mode Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mot de passe
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="passwordMode"
                        value="auto"
                        checked={passwordMode === 'auto'}
                        onChange={(e) => setPasswordMode(e.target.value as PasswordMode)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Générer automatiquement</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="passwordMode"
                        value="manual"
                        checked={passwordMode === 'manual'}
                        onChange={(e) => setPasswordMode(e.target.value as PasswordMode)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Saisir manuellement</span>
                    </label>
                  </div>

                  {passwordMode === 'manual' && (
                    <Input
                      label="Mot de passe"
                      type="password"
                      value={newUser.password || ''}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      required
                      placeholder="Entrez le mot de passe"
                    />
                  )}

                  {passwordMode === 'auto' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Un mot de passe sécurisé sera généré automatiquement
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeModal}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    isLoading={createMutation.isPending}
                  >
                    Créer
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Modifier le rôle</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Utilisateur: {editingUser.first_name} {editingUser.last_name}
            </p>

            <div className="space-y-4">
              <Select
                label="Nouveau rôle"
                options={roleOptions}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
              />

              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeEditModal}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleUpdateRole}
                  className="flex-1"
                  isLoading={updateMutation.isPending}
                >
                  Mettre à jour
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
