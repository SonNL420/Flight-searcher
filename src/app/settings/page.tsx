import { getSettings } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>
      <SettingsForm initial={settings} />
    </div>
  );
}
