import { SettingsForm } from '@/components/settings/SettingsForm';
import { AppPage } from '@/components/layout/AppPage';

export function SettingsPage() {
  return (
    <AppPage
      title="Settings"
      subtitle="Configure AI providers and application settings."
    >
      <SettingsForm />
    </AppPage>
  );
}
