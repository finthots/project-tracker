import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ClipboardList, UsersRound } from "lucide-react";
import { getNotifications, markNotificationRead } from "@/api";
import type { UserNotification } from "@/api/types";

export function NotificationBell({ variant = "icon" }: { variant?: "icon" | "sidebar" }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
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
    setOpen(false);
    if (notification.project_id) navigate(`/projects/${notification.project_id}`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${data?.unread_count ? `, ${data.unread_count} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={variant === "sidebar"
          ? "relative mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          : "relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"}
      >
        <Bell size={18} />
        {variant === "sidebar" && <span>Notifications</span>}
        {!!data?.unread_count && (variant === "sidebar"
          ? <span className="ml-auto rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{data.unread_count}</span>
          : <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />)}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[120] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              <p className="text-xs text-gray-500">Task assignments and project collaborations</p>
            </div>
            {!!data?.unread_count && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{data.unread_count} new</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!data?.notifications.length ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : data.notifications.map((notification) => {
              const collaboration = notification.kind === "collaboration_added";
              const Icon = collaboration ? UsersRound : ClipboardList;
              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${notification.read_at ? "" : "bg-blue-50/50"}`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${collaboration ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-5 text-gray-800">{notification.message}</span>
                    <span className="mt-1 block text-xs text-gray-500">{notification.created_at ? new Date(notification.created_at).toLocaleString() : "Just now"}</span>
                  </span>
                  {!notification.read_at && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                  {!!notification.read_at && <Check size={14} className="mt-1 shrink-0 text-gray-300" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">Only assignment and collaboration alerts are shown.</div>
        </div>
      )}
    </div>
  );
}
