import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types";

interface TaskTableColumnsProps {}

export function taskTableColumns(_props: TaskTableColumnsProps): ColumnDef<Task>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }: any) => {
        const task = row.original;
        return (
          <div className="flex flex-col gap-1">
            <span className="font-semibold tracking-tight">{task.title}</span>
            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">
              {task.description}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const status = row.original.status;
        return <Badge variant="secondary" className="capitalize">{status.replace('_', ' ')}</Badge>;
      },
    },
    {
      accessorKey: "role_name",
      header: "Role",
      cell: ({ row }: any) => {
        const role = row.original.role_name;
        return <span className="text-sm font-medium">{role}</span>;
      },
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }: any) => {
        const date = new Date(row.original.created_at);
        return <span className="text-sm">{date.toLocaleDateString()}</span>;
      },
    },
  ];
}
