import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { REGISTRATION_MODE_LABELS } from "../../lib/labels";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Select, Input } from "../../components/ui/Input";
import { Button, IconButton } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { XIcon, PlusIcon } from "../../components/ui/icons";
import { useToast } from "../../components/ui/Toast";

interface InstanceSettings {
  registrationMode: "open" | "invite_only" | "closed";
  defaultKeyTtlDays: number;
  cdnAllowlist: string[];
  viewRetentionDays: number;
  maxArtifactSizeBytes: number;
  inviteTtlDays: number;
}

export function AdminSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<InstanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCdnUrl, setNewCdnUrl] = useState("");

  useEffect(() => {
    api.get<{ settings: InstanceSettings }>("/admin/settings").then((r) => setSettings(r.settings));
  }, []);

  async function save(patch: Partial<InstanceSettings>) {
    setSaving(true);
    try {
      const res = await api.patch<{ settings: InstanceSettings }>("/admin/settings", patch);
      setSettings(res.settings);
      toast.show("Настройки сохранены", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось сохранить настройки", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Регистрация и приглашения" />
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <Field label="Режим регистрации" className="max-w-xs">
            <Select
              value={settings.registrationMode}
              onChange={(e) => save({ registrationMode: e.target.value as InstanceSettings["registrationMode"] })}
            >
              {Object.entries(REGISTRATION_MODE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Срок жизни приглашения, дней" className="max-w-40">
            <NumberField value={settings.inviteTtlDays} onSave={(n) => save({ inviteTtlDays: n })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="API-ключи агентов" />
        <Field label="Срок жизни ключа по умолчанию, дней" hint="0 = бессрочно" className="max-w-40">
          <NumberField value={settings.defaultKeyTtlDays} min={0} onSave={(n) => save({ defaultKeyTtlDays: n })} />
        </Field>
      </Card>

      <Card>
        <CardHeader title="Артефакты" />
        <Field label="Максимальный размер артефакта, МБ" className="max-w-40">
          <NumberField
            value={Math.round(settings.maxArtifactSizeBytes / 1024 / 1024)}
            onSave={(n) => save({ maxArtifactSizeBytes: Math.round(n * 1024 * 1024) })}
          />
        </Field>

        <Field label="Разрешённые CDN-домены для встраиваемых скриптов" className="mt-4">
          <div className="flex flex-col gap-2">
            {settings.cdnAllowlist.map((url) => (
              <div key={url} className="flex items-center gap-2">
                <code className="flex-1 rounded-control border border-border bg-panel-muted px-2.5 py-1.5 text-xs">{url}</code>
                <IconButton
                  label="Удалить"
                  size="sm"
                  onClick={() => save({ cdnAllowlist: settings.cdnAllowlist.filter((u) => u !== url) })}
                >
                  <XIcon size={14} />
                </IconButton>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                placeholder="https://cdn.example.com"
                value={newCdnUrl}
                onChange={(e) => setNewCdnUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCdnUrl) {
                    e.preventDefault();
                    save({ cdnAllowlist: [...settings.cdnAllowlist, newCdnUrl] });
                    setNewCdnUrl("");
                  }
                }}
              />
              <IconButton
                label="Добавить"
                onClick={() => {
                  if (!newCdnUrl) return;
                  save({ cdnAllowlist: [...settings.cdnAllowlist, newCdnUrl] });
                  setNewCdnUrl("");
                }}
              >
                <PlusIcon size={14} />
              </IconButton>
            </div>
          </div>
        </Field>
      </Card>

      <Card>
        <CardHeader title="Хранение статистики просмотров" description="Пока не применяется — ничего в коде инстанса ещё не удаляет старые записи по этому сроку." />
        <Field label="Хранить дней" className="max-w-40">
          <NumberField value={settings.viewRetentionDays} onSave={(n) => save({ viewRetentionDays: n })} />
        </Field>
      </Card>

      {saving && <p className="text-xs text-muted">Сохранение…</p>}
    </div>
  );
}

function NumberField({ value, min = 0, onSave }: { value: number; min?: number; onSave: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <div className="flex gap-2">
      <Input type="number" min={min} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Button
        variant="secondary"
        size="sm"
        disabled={Number(draft) === value || draft === ""}
        onClick={() => onSave(Number(draft))}
      >
        OK
      </Button>
    </div>
  );
}
