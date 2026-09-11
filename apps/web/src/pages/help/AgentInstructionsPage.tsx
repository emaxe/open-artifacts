import { Link } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardHeader } from "../../components/ui/Card";
import { CopyButton } from "../../components/ui/CopyButton";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/Table";

// Moved out of /admin — connecting an agent is something every user does for their own team, not
// a superadmin-only concern. /admin/instructions redirects here for old links/bookmarks.
export function AgentInstructionsPage() {
  const origin = window.location.origin;

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        "open-artifacts": {
          // ?orgId= sets the default team for this project — omit it if the key only belongs to one team.
          url: `${origin}/mcp?orgId=<team-id>`,
          headers: { Authorization: "Bearer oa_live_xxxxxxxxxxxxxxxxxxxxxxxx" },
        },
      },
    },
    null,
    2,
  );

  return (
    <PageContainer>
      <PageHeader title="Подключение агентов" description="Установка скилла, авторизация и шпаргалка команд для ИИ-агентов." />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="1. Установка скилла через skills.sh" />
          <p className="mb-3 text-sm text-muted">
            Скилл обучает любого ИИ-агента (Claude Code, Cursor, Codex, Windsurf, Antigravity и др.) работать с вашим
            инстансом Open Artifacts: устанавливать CLI <code>@emaxe/oa</code>, входить, публиковать артефакты и возвращать ссылки в чат.
          </p>

          <div className="mb-3.5">
            <strong className="text-sm text-fg">Установка в текущий проект (рекомендуется):</strong>
            <CodeBlock text="npx skills add emaxe/open-artifacts" />
          </div>
          <div>
            <strong className="text-sm text-fg">Установка глобально (для всех проектов на компьютере):</strong>
            <CodeBlock text="npx skills add emaxe/open-artifacts -g" />
          </div>
        </Card>

        <Card>
          <CardHeader title="2. Авторизация агента на сервере" description="Личный доступ подходит для большинства случаев; ключ агента — для CI и узких прав." />

          <div className="mb-4">
            <strong className="text-sm text-fg">Способ А: личный доступ (рекомендуется)</strong>
            <p className="my-1 text-sm text-muted">1. В терминале агент запускает:</p>
            <CodeBlock text={`oa login --server ${origin}`} />
            <p className="my-1 text-sm text-muted">
              2. Агент выведет одноразовый код (например, <code>ABCD-1234</code>) и ссылку на подтверждение.
            </p>
            <p className="my-1 text-sm text-muted">
              3. Откройте{" "}
              <Link to="/activate" className="font-medium text-fg underline">
                страницу подтверждения (/activate)
              </Link>{" "}
              и нажмите «Разрешить».
            </p>
            <p className="my-1 text-sm text-muted">
              4. Ключ сохранится в <code>~/.config/open-artifacts/credentials.json</code> и будет действовать во всех ваших
              командах — с вашей текущей ролью в каждой. Выберите команду для конкретного проекта:
            </p>
            <CodeBlock text={"oa orgs\noa use <team-slug>"} />
            <p className="my-1 text-sm text-muted">
              Выбор сохраняется в <code>.oa.json</code> рядом с проектом (без секретов, можно коммитить), а не глобально на
              компьютере.
            </p>
          </div>

          <div>
            <strong className="text-sm text-fg">Способ Б: ключ агента, запертый в одной команде (для CI)</strong>
            <p className="my-1 text-sm text-muted">
              Интерактивно: <code>oa login --agent</code> — при подтверждении на странице{" "}
              <Link to="/activate" className="font-medium text-fg underline">
                /activate
              </Link>{" "}
              нужно будет явно выбрать команду. Либо выпустите ключ вручную в веб-интерфейсе: выберите команду в сайдбаре,
              перейдите на вкладку «Агенты» и нажмите «Выпустить ключ». Затем передайте агенту переменные:
            </p>
            <CodeBlock text={`export OA_SERVER="${origin}"\nexport OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"`} />
          </div>
        </Card>

        <Card>
          <CardHeader title="3. Шпаргалка команд CLI для агента" description={<>Команды через установленный CLI <code>@emaxe/oa</code>.</>} />
          <Table>
            <THead>
              <TR>
                <TH className="w-2/5">Команда</TH>
                <TH>Описание</TH>
              </TR>
            </THead>
            <TBody>
              <TR>
                <TD><code>oa whoami</code></TD>
                <TD className="text-muted">Проверить валидность токена, сервер, тип ключа и выбранную команду</TD>
              </TR>
              <TR>
                <TD><code>oa orgs</code></TD>
                <TD className="text-muted">Список команд, доступных личному ключу, с отметкой текущей</TD>
              </TR>
              <TR>
                <TD><code>oa use &lt;team-slug&gt;</code></TD>
                <TD className="text-muted">Выбрать команду по умолчанию для текущего проекта (или <code>--global</code> — для всего компьютера)</TD>
              </TR>
              <TR>
                <TD><code>oa push report.html --title "Отчёт" --share</code></TD>
                <TD className="text-muted">Опубликовать HTML/Markdown/SVG/Mermaid и сразу сгенерировать публичную ссылку</TD>
              </TR>
              <TR>
                <TD><code>{`oa push report.html --id <id> --message "v2"`}</code></TD>
                <TD className="text-muted">Обновить существующий артефакт (сохраняет историю версий)</TD>
              </TR>
              <TR>
                <TD><code>{`oa share <id> --password "123" --expires 7d`}</code></TD>
                <TD className="text-muted">Поделиться артефактом с защитой паролем или ограничением срока жизни</TD>
              </TR>
              <TR>
                <TD><code>oa list</code></TD>
                <TD className="text-muted">Список всех опубликованных артефактов в текущей команде</TD>
              </TR>
              <TR>
                <TD><code>{`oa get <id> -o local.html`}</code></TD>
                <TD className="text-muted">Скачать текущее содержимое артефакта из инстанса</TD>
              </TR>
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeader
            title="4. Подключение через MCP (Model Context Protocol)"
            description={<>Встроенный MCP-сервер по адресу <code>{origin}/mcp</code> — подключается напрямую в Cursor, Claude Desktop, Claude Code без CLI.</>}
          />
          <CodeBlock text={mcpConfig} />
          <p className="mt-3 text-sm text-muted">
            Личный ключ видит все ваши команды — параметр <code>?orgId=</code> в URL задаёт команду по умолчанию для этого
            проектного конфига (обычно <code>.mcp.json</code> рядом с проектом). Если у ключа только одна команда, параметр не
            нужен; если команд несколько и <code>orgId</code> не задан, инструменты вернут список команд и попросят уточнить.
            Ключ агента (Способ Б) всегда действует в своей единственной команде — параметр ему не нужен.
          </p>
          <p className="mt-2 text-sm text-muted">
            <b>Доступные MCP-инструменты:</b> <code>whoami</code>, <code>list_orgs</code>, <code>list_artifacts</code>,{" "}
            <code>get_artifact</code>, <code>create_artifact</code>, <code>update_artifact</code>, <code>delete_artifact</code>,{" "}
            <code>create_share</code>, <code>list_shares</code>, <code>revoke_share</code>.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <div className="mt-1.5 flex items-start gap-2">
      <pre className="flex-1 overflow-x-auto rounded-control bg-panel-muted p-2.5 text-xs">
        <code>{text}</code>
      </pre>
      <CopyButton value={text} />
    </div>
  );
}
