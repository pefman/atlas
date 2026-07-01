import { SettingsForm } from '@/components/settings/SettingsForm';

export function SettingsPage() {
  return (
    <div className="flex-1 p-6">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <SettingsForm />
    </div>
  );
}
