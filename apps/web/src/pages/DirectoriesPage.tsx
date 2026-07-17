import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCreateEpic, useEpics, useSetEpicActive } from "@/hooks/api";

/** SRS §34.8 — справочники (пока только эпики; шаблоны/лимиты — вне MVP-скоупа). */
export function DirectoriesPage() {
  const { data: epics } = useEpics("EMPLOYEE");
  const create = useCreateEpic();
  const setActive = useSetEpicActive();
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Справочники — Эпики</h1>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex gap-2">
            <Input placeholder="Новый эпик..." value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ channel: "EMPLOYEE", name });
                setName("");
              }}
            >
              Добавить
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {epics?.map((epic) => (
              <div key={epic.id} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-sm">
                  {epic.name}
                  {!epic.isActive && <Badge variant="outline">неактивен</Badge>}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActive.mutate({ id: epic.id, isActive: !epic.isActive })}
                >
                  {epic.isActive ? "Деактивировать" : "Активировать"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
