import { useState } from "react";
import { Check, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OtpInput } from "@/components/ui/otp-input";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-mono text-label font-medium uppercase tracking-wide text-text-3">{title}</h2>
      <Card>
        <CardContent className="flex flex-wrap items-start gap-6 p-5">{children}</CardContent>
      </Card>
    </div>
  );
}

function Swatch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta text-text-3">{label}</p>
      {children}
    </div>
  );
}

/** Справочная страница — не пункт меню, открывается по прямому адресу
 * (/component-library). Каждый примитив в основных состояниях, обе темы — тумблер
 * уже есть в Topbar. design_rework/UI_REWORK_BRIEF.md "Лист библиотеки компонентов". */
export function ComponentLibraryPage() {
  const [otp, setOtp] = useState("");

  return (
    <div className="flex max-w-[1100px] flex-col gap-6">
      <div>
        <h1 className="text-title font-bold text-text-1">Компоненты</h1>
        <p className="mt-0.5 text-meta text-text-3">Справочный лист — не часть навигации</p>
      </div>

      <Section title="Кнопки">
        <Swatch label="default">
          <Button>Продолжить</Button>
        </Swatch>
        <Swatch label="outline">
          <Button variant="outline">Отменить</Button>
        </Swatch>
        <Swatch label="ghost">
          <Button variant="ghost">Пропустить</Button>
        </Swatch>
        <Swatch label="destructive">
          <Button variant="destructive">Удалить необратимо</Button>
        </Swatch>
        <Swatch label="link">
          <Button variant="link">Подробнее</Button>
        </Swatch>
        <Swatch label="disabled">
          <Button disabled>Недоступно</Button>
        </Swatch>
        <Swatch label="icon">
          <Button size="icon" aria-label="Поиск">
            <Search className="size-4" />
          </Button>
        </Swatch>
        <Swatch label="sm / lg">
          <div className="flex items-center gap-2">
            <Button size="sm">Малая</Button>
            <Button size="lg">Крупная</Button>
          </div>
        </Swatch>
      </Section>

      <Section title="Статусные пилюли">
        <Swatch label="default (открыто)">
          <Badge>Открыто</Badge>
        </Swatch>
        <Swatch label="progress (в работе)">
          <Badge variant="progress">В работе</Badge>
        </Swatch>
        <Swatch label="warning (на проверке)">
          <Badge variant="warning">На проверке</Badge>
        </Swatch>
        <Swatch label="success (закрыто)">
          <Badge variant="success">Закрыто</Badge>
        </Swatch>
        <Swatch label="destructive (просрочено)">
          <Badge variant="destructive">Просрочено</Badge>
        </Swatch>
        <Swatch label="confidential">
          <Badge variant="confidential">Конфиденциально</Badge>
        </Swatch>
        <Swatch label="outline">
          <Badge variant="outline">Нейтрально</Badge>
        </Swatch>
      </Section>

      <Section title="Поля ввода">
        <Swatch label="обычное">
          <Input placeholder="Email" className="w-56" />
        </Swatch>
        <Swatch label="фокус">
          <Input placeholder="Email" className="w-56" autoFocus />
        </Swatch>
        <Swatch label="ошибка">
          <Input placeholder="Email" className="w-56" aria-invalid defaultValue="не то" />
        </Swatch>
        <Swatch label="disabled">
          <Input placeholder="Недоступно" className="w-56" disabled />
        </Swatch>
        <Swatch label="с лейблом">
          <div className="flex w-56 flex-col gap-1.5">
            <Label htmlFor="lib-email">Email</Label>
            <Input id="lib-email" placeholder="you@lemarkllc.ru" />
          </div>
        </Swatch>
        <Swatch label="textarea">
          <Textarea placeholder="Комментарий…" className="w-64" rows={3} />
        </Swatch>
        <Swatch label="OTP (6 полей)">
          <OtpInput value={otp} onChange={setOtp} />
        </Swatch>
      </Section>

      <Section title="Select">
        <Swatch label="закрытый">
          <Select defaultValue="open">
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Открыто</SelectItem>
              <SelectItem value="progress">В работе</SelectItem>
              <SelectItem value="closed">Закрыто</SelectItem>
            </SelectContent>
          </Select>
        </Swatch>
      </Section>

      <Section title="Чипы / переключатели">
        <Swatch label="активный">
          <span className="rounded-full bg-action px-3 py-1 text-ui font-medium text-action-fg">Активные</span>
        </Swatch>
        <Swatch label="неактивный">
          <span className="rounded-full bg-surface-sunk px-3 py-1 text-ui font-medium text-text-2">Все</span>
        </Swatch>
        <Swatch label="сегмент (2)">
          <div className="inline-flex gap-1 rounded-full bg-surface-sunk p-1">
            <span className="rounded-full bg-action px-3 py-1 text-ui font-medium text-action-fg">Список</span>
            <span className="rounded-full px-3 py-1 text-ui font-medium text-text-2">Kanban</span>
          </div>
        </Swatch>
      </Section>

      <Section title="Вкладки">
        <Tabs defaultValue="a" className="w-full">
          <TabsList>
            <TabsTrigger value="a">Тред</TabsTrigger>
            <TabsTrigger value="b">Обращение</TabsTrigger>
            <TabsTrigger value="c">Вложения</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="text-ui text-text-2">
            Содержимое вкладки «Тред».
          </TabsContent>
          <TabsContent value="b" className="text-ui text-text-2">
            Содержимое вкладки «Обращение».
          </TabsContent>
          <TabsContent value="c" className="text-ui text-text-2">
            Содержимое вкладки «Вложения».
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Таблица (grid-паттерн)">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>Тема</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono tabular-nums">HL-2026-00001</TableCell>
              <TableCell>Пример строки реестра</TableCell>
              <TableCell>
                <Badge variant="progress">В работе</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="Диалог / поповер">
        <Swatch label="dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Открыть диалог</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Заголовок диалога</DialogTitle>
              <DialogDescription>Пояснение под заголовком, вторичный текст.</DialogDescription>
              <DialogFooter>
                <Button variant="outline">Отменить</Button>
                <Button>Подтвердить</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Swatch>
        <Swatch label="popover">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Открыть поповер</Button>
            </PopoverTrigger>
            <PopoverContent className="p-3">
              <p className="text-ui text-text-1">Содержимое поповера.</p>
            </PopoverContent>
          </Popover>
        </Swatch>
      </Section>

      <Section title="Пример карточки">
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Заголовок карточки</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 pt-0">
            <Check className="size-4 text-status-closed" />
            <span className="text-ui text-text-2">Готово</span>
          </CardContent>
        </Card>
        <Card className="flex w-72 items-start gap-3 p-4">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md bg-status-open-tint text-status-open")}>
            <Mail className="size-[18px]" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-meta text-text-3">KPI-тайл</p>
            <p className="mt-0.5 font-mono text-title font-semibold tabular-nums text-text-1">12</p>
          </div>
        </Card>
      </Section>
    </div>
  );
}
