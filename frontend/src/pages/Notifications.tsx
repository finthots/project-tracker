import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ClipboardList, UsersRound } from "lucide-react";
import { getNotifications, markNotificationRead } from "@/api";
import type { UserNotification } from "@/api/types";

export function Notifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications().then((response) => response.data),
    refetchInterval: 15_000,
  });
  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const openNotification = (notification: UserNotification) => {
    if (!notification.read_at) readMutation.mutate(notification.id);
    if (notification.project_id) navigate(`/projects/${notification.project_id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">Project collaborations and task assignments</p>
        </div>
        {!!data?.unread_count && <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">{data.unread_count} unread</span>}
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white" aria-label="Your notifications">
        {isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">Loading notifications…</p>
        ) : !data?.notifications.length ? (
          <div className="px-5 py-12 text-center">
            <Bell className="mx-auto mb-3 text-gray-300" size={28} />
            <p className="font-medium text-gray-700">You’re all caught up</p>
            <p className="mt-1 text-sm text-gray-500">New task assignments and project collaborations will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.notifications.map((notification) => {
              const collaboration = notification.kind === "collaboration_added";
              const Icon = collaboration ? UsersRound : ClipboardList;
              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 sm:px-5 ${notification.read_at ? "" : "bg-blue-50/50"}`}
                >
                  <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${collaboration ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-6 text-gray-900">{notification.message}</span>
                    <span className="mt-1 block text-xs text-gray-500">{notification.created_at ? new Date(notification.created_at).toLocaleString() : "Just now"}</span>
                  </span>
                  {!notification.read_at
                    ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />
                    : <Check className="mt-1 shrink-0 text-gray-300" size={16} />}
                </button>
              );
            })}
          </div>
        )}
      </section>
      <p className="mt-3 text-xs text-gray-400">Showing your 30 most recent notifications.</p>
    </div>
  );
}
