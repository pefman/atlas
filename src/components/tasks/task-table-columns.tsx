import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Task } from "@/types";

interface TaskTableColumnsProps {
  onExecute: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  onView: (taskId: number) => void;
}

export function taskTableColumns({ onExecute, onDelete, onView }: TaskTableColumnsProps): ColumnDef<Task>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }: any) => {
        const task = row.original;
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{task.title}</span>
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
        return <Badge variant="secondary">{status}</Badge>;
      },
    },
    {
      accessorKey: "role_name",
      header: "Role",
      cell: ({ row }: any) => {
        const role = row.original.role_name;
        return <span className="text-sm">{role}</span>;
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
    {
      id: "actions",
      cell: ({ row }: any) => {
        const task = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onView(task.id)}>
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExecute(task.id)}>
                <Play className="h-4 w-4 mr-2" />
                Execute
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(task.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
