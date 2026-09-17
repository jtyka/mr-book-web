"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, MailCheck, Lock, LockOpen } from "lucide-react";
import { adminApi, AdminUserDto, AdminUserUpdateDto } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// Fehlermeldung der API ("API 400: {"error":"…"}") lesbar machen.
function apiErrorMessage(e: Error): string {
  const match = e.message.match(/^API \d+: ([\s\S]*)$/);
  if (match) {
    try {
      const body = JSON.parse(match[1]);
      if (typeof body.error === "string") return body.error;
    } catch {
      // kein JSON, Originalmeldung verwenden
    }
  }
  return e.message;
}

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [lockUser, setLockUser] = useState<AdminUserDto | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, pageSize],
    queryFn: () => adminApi.listUsers(page, pageSize),
    enabled: isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: AdminUserUpdateDto }) =>
      adminApi.updateUser(id, dto),
    onSuccess: (_updated, { dto }) => {
      if (dto.emailVerified) toast.success("E-Mail bestätigt");
      else if (dto.disabled) toast.success("Konto gesperrt");
      else toast.success("Konto entsperrt");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setLockUser(undefined);
    },
    onError: (e: Error) => toast.error(apiErrorMessage(e)),
  });

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Nutzerverwaltung</h1>
        <p className="text-muted-foreground">Keine Berechtigung.</p>
      </div>
    );
  }

  const columns: ColumnDef<AdminUserDto>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.role === "ADMIN" && <Badge variant="secondary">Admin</Badge>}
        </div>
      ),
    },
    { accessorKey: "email", header: "E-Mail" },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.disabledAt ? (
            <Badge variant="destructive">Gesperrt</Badge>
          ) : (
            <Badge variant="outline">Aktiv</Badge>
          )}
          {!row.original.emailVerified && (
            <Badge variant="outline" className="text-muted-foreground">
              Unbestätigt
            </Badge>
          )}
        </div>
      ),
    },
    { accessorKey: "bookCount", header: "Bücher" },
    {
      accessorKey: "lastLoginAt",
      header: "Letzter Login",
      cell: ({ row }) => formatDateTime(row.original.lastLoginAt),
    },
    {
      accessorKey: "createdAt",
      header: "Angelegt",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const u = row.original;
        const isSelf = u.id === user?.id;
        if (u.emailVerified && isSelf) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!u.emailVerified && (
                <DropdownMenuItem
                  onClick={() => updateMutation.mutate({ id: u.id, dto: { emailVerified: true } })}
                >
                  <MailCheck className="h-4 w-4 mr-2" /> E-Mail bestätigen
                </DropdownMenuItem>
              )}
              {u.disabledAt ? (
                <DropdownMenuItem
                  onClick={() => updateMutation.mutate({ id: u.id, dto: { disabled: false } })}
                >
                  <LockOpen className="h-4 w-4 mr-2" /> Entsperren
                </DropdownMenuItem>
              ) : (
                !isSelf && (
                  <DropdownMenuItem className="text-destructive" onClick={() => setLockUser(u)}>
                    <Lock className="h-4 w-4 mr-2" /> Sperren
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nutzerverwaltung</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data?.totalElements ?? 0} Nutzer
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.content ?? []}
        totalElements={data?.totalElements ?? 0}
        totalPages={data?.totalPages ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        isLoading={isLoading}
      />

      <AlertDialog open={!!lockUser} onOpenChange={(o) => !o && setLockUser(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konto sperren?</AlertDialogTitle>
            <AlertDialogDescription>
              „{lockUser?.name}“ ({lockUser?.email}) wird sofort abgemeldet und kann sich
              nicht mehr anmelden. Die Daten bleiben erhalten, das Konto lässt sich
              jederzeit wieder entsperren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                lockUser && updateMutation.mutate({ id: lockUser.id, dto: { disabled: true } })
              }
            >
              Sperren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
